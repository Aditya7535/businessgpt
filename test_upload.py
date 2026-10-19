import urllib.request, json

with open('sample_sales_data.csv', 'rb') as f:
    data = f.read()

boundary = b'boundary123'
body = (
    b'--' + boundary + b'\r\n'
    b'Content-Disposition: form-data; name="file"; filename="sample_sales_data.csv"\r\n'
    b'Content-Type: text/csv\r\n\r\n'
    + data +
    b'\r\n--' + boundary + b'--\r\n'
)

req = urllib.request.Request('http://localhost:8000/api/upload', data=body, method='POST')
req.add_header('Content-Type', 'multipart/form-data; boundary=boundary123')

try:
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
        print('SUCCESS! id:', result.get('id'), '| file:', result.get('filename'), '| rows:', result.get('row_count'), '| type:', result.get('dataset_type'))
except Exception as e:
    print('ERROR:', e)
