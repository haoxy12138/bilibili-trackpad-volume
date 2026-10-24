#!/usr/bin/env python3
"""Validate userscript metadata and build deterministic, dependency-free assets."""

import argparse
import hashlib
import json
import re
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'bilibili-trackpad-volume.user.js'
META = ROOT / 'bilibili-trackpad-volume.meta.js'
BASE = 'https://raw.githubusercontent.com/haoxy12138/bilibili-trackpad-volume/main/'


def validate():
    source = SOURCE.read_text(encoding='utf-8')
    match = re.match(r'// ==UserScript==\n.*?// ==/UserScript==\n', source, re.S)
    if not match:
        raise SystemExit('Missing userscript metadata header')
    header = match.group()
    entries = re.findall(r'^// @(\S+)\s+(.+)$', header, re.M)
    tags = dict(entries)
    package = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
    expected = {
        'name': 'Bilibili 网页全屏音量方向',
        'namespace': 'local.bilibili.webfull.volume',
        'version': package['version'],
        'match': 'https://www.bilibili.com/video/*',
        'run-at': 'document-start',
        'sandbox': 'raw',
        'grant': 'none',
        'updateURL': BASE + META.name,
        'downloadURL': BASE + SOURCE.name,
    }
    for key, value in expected.items():
        if tags.get(key) != value:
            raise SystemExit(f'Unexpected @{key}: {tags.get(key)!r}')
    if [v for k, v in entries if k == 'match'] != [expected['match']]:
        raise SystemExit('Unexpected additional site matches')
    if any(key in tags for key in ['require', 'connect']):
        raise SystemExit('Unexpected runtime dependency or connection permission')
    if 'BILI_WEBFULL_' in source or 'console.' in source:
        raise SystemExit('Diagnostic logging must not ship in the public script')
    ET.parse(ROOT / 'docs/assets/hero.svg')
    return header, package['version']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Check committed release metadata only')
    args = parser.parse_args()
    header, version = validate()
    if args.check:
        if not META.exists() or META.read_text(encoding='utf-8') != header:
            raise SystemExit('Metadata is stale: run npm run build and commit the .meta.js file')
        print(f'Release metadata and SVG are valid: v{version}')
        return

    META.write_text(header, encoding='utf-8', newline='\n')
    dist = ROOT / 'dist'
    dist.mkdir(exist_ok=True)
    assets = [dist / SOURCE.name, dist / META.name]
    shutil.copyfile(SOURCE, assets[0])
    shutil.copyfile(META, assets[1])

    archive = dist / 'bilibili-trackpad-volume-import.zip'
    with ZipFile(archive, 'w', compression=ZIP_DEFLATED) as output:
        for path in [SOURCE, ROOT / 'LICENSE']:
            entry = ZipInfo(path.name, date_time=(1980, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            output.writestr(entry, path.read_bytes())
    assets.append(archive)
    sums = '\n'.join(
        f'{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}'
        for path in sorted(assets)
    ) + '\n'
    (dist / 'SHA256SUMS').write_text(sums, encoding='ascii', newline='\n')
    for path in assets + [dist / 'SHA256SUMS']:
        print(path.relative_to(ROOT))


if __name__ == '__main__':
    main()
