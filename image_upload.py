import base64
import requests
import sys

file_path = sys.argv[1]

file_name = file_path.split('/')[-1]
token = sys.argv[2]
parent_id = sys.argv[3]

file_encoded = None
with open(file_path, "rb") as image_file:
    file_encoded = base64.b64encode(image_file.read()).decode('utf-8')

r_jsonold = { 'name': file_name, 'type': 'image', 'isPublic': True, 'data': file_encoded, 'parentId': sys.argv[3] }
r_jsonold2 = { 'name': file_name, 'type': 'image', 'isPublic': True, 'data': file_encoded, 'parentId': int(parent_id) if parent_id.isdigit() else parent_id}
r_json = { 'name': file_name, 'type': 'image', 'isPublic': True, 'data': file_encoded, 'parentId': 0}

r_headers = { 'X-Token': sys.argv[2] }

r = requests.post("http://0.0.0.0:5000/files", json=r_json, headers=r_headers)
print(r.json())
