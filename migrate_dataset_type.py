import pg8000.native

conn = pg8000.native.Connection(
    'postgres', password='postgres', host='localhost', port=5432, database='businessgpt'
)
try:
    conn.run("ALTER TABLE datasets ADD COLUMN IF NOT EXISTS dataset_type VARCHAR NOT NULL DEFAULT 'unknown'")
    print('SUCCESS: dataset_type column added (or already existed).')
except Exception as e:
    print(f'ERROR: {e}')
finally:
    conn.close()
