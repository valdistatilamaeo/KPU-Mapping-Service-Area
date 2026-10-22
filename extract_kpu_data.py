import zipfile
import xml.etree.ElementTree as ET
import urllib.request
import re
import json
import os
import concurrent.futures

EXCEL_PATH = r"d:\Arif\Maps KPU Indo\Datasheet Map Kantor KPU.xlsx"
OUTPUT_JSON = r"d:\Arif\Maps KPU Indo\kpu_data.json"

def parse_excel():
    with zipfile.ZipFile(EXCEL_PATH, 'r') as z:
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for si in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
                texts = [elem.text or '' for elem in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')]
                shared_strings.append(''.join(texts))

        sheet_tree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        rels_tree = ET.fromstring(z.read('xl/worksheets/_rels/sheet1.xml.rels'))
        rel_map = {
            rel.attrib.get('Id'): rel.attrib.get('Target')
            for rel in rels_tree.findall('{http://schemas.openxmlformats.org/package/2006/relationships}Relationship')
        }

        hyperlink_map = {}
        hyperlinks = sheet_tree.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}hyperlinks')
        if hyperlinks is not None:
            for hl in hyperlinks:
                ref = hl.attrib.get('ref')
                r_id = hl.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                if ref and r_id in rel_map:
                    hyperlink_map[ref] = rel_map[r_id]

        sheet_data = sheet_tree.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheetData')
        
        rows_data = []
        for row in sheet_data.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
            row_idx = int(row.attrib.get('r', 0))
            if row_idx == 1:
                continue # Skip header

            cells = {}
            for c in row.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                r_ref = c.attrib.get('r', '')
                col_letter = ''.join(filter(str.isalpha, r_ref))
                t = c.attrib.get('t', '')
                v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                val = v.text if v is not None else ''
                if t == 's' and val.isdigit():
                    val = shared_strings[int(val)]
                cells[col_letter] = val

            no = cells.get('A', str(row_idx - 1))
            site = cells.get('B', '').strip()
            region = cells.get('C', '').strip()
            alamat = cells.get('D', '').strip()
            engineer = cells.get('E', '').strip()
            d_ref = f"D{row_idx}"
            map_url = hyperlink_map.get(d_ref, '')

            if site or alamat:
                rows_data.append({
                    "id": len(rows_data) + 1,
                    "no": no,
                    "nama_tempat": site,
                    "region": region,
                    "alamat": alamat,
                    "engineer": engineer,
                    "map_url": map_url,
                    "latitude": None,
                    "longitude": None,
                    "telepon": ""
                })

        return rows_data

def resolve_coords(item):
    url = item.get("map_url")
    alamat = item.get("alamat", "")

    # Extract phone from alamat if present
    # Examples: 0878-4858-0588, (0651) 47770, 08123456789
    phone_match = re.search(r'(\+?62[\d\s-]{8,15}|08[\d\s-]{8,14}|\(0\d{2,4}\)\s*[\d-]{5,10})', alamat)
    if phone_match:
        item["telepon"] = phone_match.group(1).strip()

    # Extract kota/kabupaten from site or alamat
    # e.g., "Kantor KPU/KIP Kabupaten Aceh Utara" -> "Kabupaten Aceh Utara"
    kota_match = re.search(r'(Kabupaten\s+[A-Za-z\s]+|Kota\s+[A-Za-z\s]+|Kab\.\s+[A-Za-z\s]+)', item.get("nama_tempat", "") + " " + alamat)
    if kota_match:
        # Clean trailing commas or words
        cleaned_kota = kota_match.group(1).split(',')[0].strip()
        item["kota"] = cleaned_kota
    else:
        item["kota"] = item.get("region", "Indonesia")

    if not url or not (url.startswith('http://') or url.startswith('https://')):
        if url:
            item["resolved_url"] = f"https://www.google.com/maps/search/?api=1&query={url}"
        return item

    try:
        req = urllib.request.Request(
            url,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, timeout=12) as resp:
            final_url = resp.geturl()
            item["resolved_url"] = final_url

            # Try @lat,lng
            m = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', final_url)
            if m:
                item["latitude"] = float(m.group(1))
                item["longitude"] = float(m.group(2))
                return item

            # Try !3dlat!4dlng
            m2 = re.search(r'!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)', final_url)
            if m2:
                item["latitude"] = float(m2.group(1))
                item["longitude"] = float(m2.group(2))
                return item

            # Try query ?q=lat,lng
            m3 = re.search(r'[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)', final_url)
            if m3:
                item["latitude"] = float(m3.group(1))
                item["longitude"] = float(m3.group(2))
                return item
    except Exception as e:
        item["error"] = str(e)

    return item

def main():
    print("Reading Excel...")
    items = parse_excel()
    print(f"Loaded {len(items)} items. Resolving Google Maps links with 30 threads...")

    with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
        results = list(executor.map(resolve_coords, items))

    resolved_count = sum(1 for r in results if r["latitude"] is not None)
    print(f"Finished! Successfully resolved coordinates for {resolved_count}/{len(results)} items.")

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"Saved to {OUTPUT_JSON}")

if __name__ == "__main__":
    main()
