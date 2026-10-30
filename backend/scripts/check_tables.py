import psycopg2
conn = psycopg2.connect(dbname='ResolveAI', user='postgres', password='admin', host='localhost', port=5432)
cur = conn.cursor()
cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
tables = [r[0] for r in cur.fetchall()]
print(f'Tables created: {len(tables)}')
for t in tables:
    print(f'  - {t}')
conn.close()
