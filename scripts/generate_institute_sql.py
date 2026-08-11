import zipfile
import xml.etree.ElementTree as ET
import re
import os

excel_path = r'e:\DCMMS-with-Supabase\396 list.xlsx'
sql_out_path = r'e:\DCMMS-with-Supabase\prisma\insert_institute_table.sql'

with zipfile.ZipFile(excel_path) as z:
    shared_strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
        ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        for si in tree.findall('.//ns:si', ns):
            t_elems = si.findall('.//ns:t', ns)
            text = ''.join([t.text for t in t_elems if t.text])
            shared_strings.append(text)

    sheet_tree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
    ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    rows = sheet_tree.findall('.//ns:row', ns)
    
    extracted = []
    for r in rows:
        r_idx = r.attrib.get('r')
        cells = r.findall('ns:c', ns)
        c_dict = {}
        for c in cells:
            ref = c.attrib.get('r')
            col = re.sub(r'[0-9]', '', ref)
            t = c.attrib.get('t')
            v = c.find('ns:v', ns)
            val = v.text if v is not None else ''
            if t == 's' and val.isdigit():
                val = shared_strings[int(val)]
            c_dict[col] = val.strip() if val else ''
        
        if r_idx and int(r_idx) >= 4:
            school_name = c_dict.get('B', '')
            address = c_dict.get('C', '')
            province = c_dict.get('D', '')
            district = c_dict.get('E', '')
            zone = c_dict.get('F', '')
            province_clean = re.sub(r'^\d+\.\s*', '', province)
            
            if school_name:
                extracted.append((school_name, address, province_clean, district, zone))

sql_lines = []
sql_lines.append('-- Create institute_table if not exists')
sql_lines.append('''CREATE TABLE IF NOT EXISTS institute_table (
    id BIGSERIAL PRIMARY KEY,
    institute_name VARCHAR(255) NOT NULL,
    address TEXT,
    province VARCHAR(100),
    district VARCHAR(100),
    zone VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
''')

sql_lines.append('-- Insert 396 records into institute_table')
sql_lines.append('INSERT INTO institute_table (institute_name, address, province, district, zone) VALUES')

values_list = []
for name, addr, prov, dist, z in extracted:
    name_esc = name.replace("'", "''")
    addr_esc = addr.replace("'", "''")
    prov_esc = prov.replace("'", "''")
    dist_esc = dist.replace("'", "''")
    z_esc = z.replace("'", "''")
    
    val_str = f"    ('{name_esc}', '{addr_esc}', '{prov_esc}', '{dist_esc}', '{z_esc}')"
    values_list.append(val_str)

sql_lines.append(',\n'.join(values_list) + ';')

full_sql = '\n'.join(sql_lines)
with open(sql_out_path, 'w', encoding='utf-8') as f:
    f.write(full_sql)

print(f"Successfully generated SQL file with {len(extracted)} rows at {sql_out_path}")
