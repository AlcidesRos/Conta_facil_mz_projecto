const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('ERRO: a variável de ambiente DATABASE_URL não está definida. Verifique o seu ficheiro .env.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Se o seu Postgres exigir SSL (ex: alguns provedores geridos), descomente:
  // ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
  console.error('Erro inesperado no pool de ligações do PostgreSQL:', err);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  // Útil para transações (ex: registar pagamento + atualizar saldo devedor)
  getClient: () => pool.connect(),
};
