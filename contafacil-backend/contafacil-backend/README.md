# ContaFácil MZ — Backend (Node.js/Express + PostgreSQL)

API que dá suporte ao frontend do ContaFácil MZ: autenticação, produtos, estoque,
clientes/pagamentos, receitas/despesas e agregações para o dashboard.

## 1. Requisitos no VPS

- Ubuntu 22.04 (ou similar)
- Node.js 20 LTS
- PostgreSQL 15+
- (Recomendado) PM2 para manter o processo sempre ativo
- (Recomendado) Nginx como proxy reverso + certificado SSL (Let's Encrypt)

## 2. Instalar Node.js e PostgreSQL

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib
```

## 3. Criar a base de dados e o utilizador

```bash
sudo -u postgres psql
```
```sql
CREATE DATABASE contafacil;
CREATE USER contafacil_user WITH ENCRYPTED PASSWORD 'escolha_uma_senha_forte';
GRANT ALL PRIVILEGES ON DATABASE contafacil TO contafacil_user;
\q
```

## 4. Instalar e configurar o backend

```bash
# Copie a pasta contafacil-backend para o servidor, depois:
cd contafacil-backend
npm install
cp .env.example .env
nano .env   # preencha DATABASE_URL, JWT_SECRET e CORS_ORIGIN
```

Gerar um `JWT_SECRET` seguro:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 5. Aplicar as migrações (criar as tabelas)

```bash
npm run migrate
```

Isto executa todos os ficheiros em `/migrations` por ordem. Para adicionar novas
tabelas no futuro (Vendas, Fornecedores, Compras, Caixa, Funcionários), basta
criar um novo ficheiro `002_....sql` nessa pasta e correr `npm run migrate` de novo.

## 6. Testar localmente

```bash
npm start
# ou, durante o desenvolvimento, com reinício automático:
npm run dev
```

Verifique: `curl http://localhost:4000/api/health` deve devolver `{"status":"ok",...}`.

## 6.1 Testar em localhost com o frontend

O ficheiro `contafacil-mz.html` faz pedidos `fetch` para `http://localhost:4000/api`.
Para isso funcionar sem erros de CORS, **não abra o ficheiro diretamente com
duplo clique** (isso usa o protocolo `file://`, que a maior parte dos
navegadores trata de forma inconsistente com CORS). Em vez disso, sirva-o com
um servidor local simples, por exemplo:

```bash
cd pasta-onde-esta-o-contafacil-mz.html
python3 -m http.server 8080
# ou, se tiver Node instalado:
npx serve -l 8080
```

Depois abra `http://localhost:8080/contafacil-mz.html` no navegador, e
certifique-se de que `CORS_ORIGIN=http://localhost:8080` está no `.env` do
backend (reinicie o backend depois de alterar o `.env`).

## 7. Colocar em produção com PM2

```bash
sudo npm install -g pm2
pm2 start src/server.js --name contafacil-api
pm2 save
pm2 startup   # siga a instrução impressa para arrancar automaticamente no boot
```

## 8. Nginx como proxy reverso (recomendado)

```nginx
server {
    listen 80;
    server_name api.contafacilmz.co.mz;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Depois ative o SSL gratuito com Certbot:
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.contafacilmz.co.mz
```

## 9. Estrutura de pastas

```
contafacil-backend/
├── migrations/
│   └── 001_init.sql          # esquema completo da base de dados
├── src/
│   ├── db.js                 # pool de ligação ao Postgres
│   ├── server.js             # ponto de entrada da aplicação
│   ├── middleware/
│   │   ├── auth.js           # verificação de JWT
│   │   └── errorHandler.js   # tratamento central de erros
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── produtos.routes.js
│   │   ├── estoque.routes.js
│   │   ├── clientes.routes.js
│   │   ├── transacoes.routes.js
│   │   └── dashboard.routes.js
│   └── scripts/
│       └── migrate.js
├── .env.example
└── package.json
```

## 10. Principais endpoints

| Método | Rota                                | Descrição |
|--------|--------------------------------------|-----------|
| POST   | `/api/auth/register`                | Cria empresa + utilizador admin |
| POST   | `/api/auth/login`                   | Login, devolve token JWT |
| GET    | `/api/auth/me`                      | Dados do utilizador autenticado |
| PUT    | `/api/auth/empresa`                 | Atualizar dados do negócio (Perfil) |
| PUT    | `/api/auth/usuario`                 | Atualizar nome/telefone do utilizador |
| PUT    | `/api/auth/senha`                   | Trocar a senha (exige a senha atual) |
| GET    | `/api/produtos?busca=`              | Listar/pesquisar produtos |
| POST   | `/api/produtos`                     | Criar produto |
| PUT    | `/api/produtos/:id`                 | Editar produto |
| DELETE | `/api/produtos/:id`                 | Remover produto |
| GET    | `/api/estoque/movimentacoes`        | Histórico de entradas/saídas |
| GET    | `/api/estoque/alertas`              | Produtos com estoque baixo |
| POST   | `/api/estoque/movimentacoes`        | Registar entrada/saída (atómico) |
| GET    | `/api/clientes`                     | Listar clientes |
| POST   | `/api/clientes`                     | Criar cliente |
| POST   | `/api/clientes/:id/pagamentos`      | Registar pagamento (abate dívida + lança receita) |
| GET    | `/api/clientes/:id/pagamentos`      | Histórico de pagamentos do cliente |
| GET    | `/api/transacoes?tipo=&periodo=`    | Listar receitas/despesas filtradas |
| POST   | `/api/transacoes`                   | Criar receita/despesa |
| DELETE | `/api/transacoes/:id`               | Remover lançamento |
| GET    | `/api/dashboard/resumo?periodo=`    | Saldo, receitas, despesas, lucro |
| GET    | `/api/dashboard/mensal`             | Dados dos últimos 6 meses (gráfico) |
| GET    | `/api/dashboard/categorias?tipo=`   | Totais por categoria (gráfico) |
| GET    | `/api/fornecedores`                 | Listar fornecedores |
| POST   | `/api/fornecedores`                 | Criar fornecedor |
| PUT    | `/api/fornecedores/:id`             | Editar fornecedor |
| DELETE | `/api/fornecedores/:id`             | Remover fornecedor |
| GET    | `/api/compras`                      | Listar compras (com itens) |
| POST   | `/api/compras`                      | Registar compra (atualiza estoque + custo médio + lança despesa) |
| GET    | `/api/vendas`                       | Listar vendas (com itens) |
| POST   | `/api/vendas`                       | Registar venda no PDV (baixa estoque + calcula lucro + lança receita) |
| GET    | `/api/caixa/atual`                  | Sessão de caixa aberta (se existir) |
| GET    | `/api/caixa/historico`              | Histórico de fechos de caixa |
| POST   | `/api/caixa/abrir`                  | Abrir caixa (saldo inicial) |
| POST   | `/api/caixa/fechar`                 | Fechar caixa (calcula diferença) |
| GET    | `/api/funcionarios`                 | Listar funcionários |
| POST   | `/api/funcionarios`                 | Criar funcionário |
| PUT    | `/api/funcionarios/:id`             | Editar funcionário |
| DELETE | `/api/funcionarios/:id`             | Remover funcionário |
| GET    | `/api/notificacoes`                 | Alertas em tempo real + histórico |
| PATCH  | `/api/notificacoes/:id/lida`        | Marcar notificação como lida |
| GET    | `/api/pagamentos/estado`            | Diz se M-Pesa/e-Mola estão configurados ou em simulação |
| GET    | `/api/pagamentos`                   | Histórico de pagamentos móveis |
| POST   | `/api/pagamentos/mpesa/c2b`         | Inicia um pagamento M-Pesa (pede PIN ao cliente) |
| POST   | `/api/pagamentos/emola/c2b`         | Inicia um pagamento e-Mola |

### Pagamentos móveis (M-Pesa / e-Mola) — como ligar a sério

Por omissão, o sistema corre em **modo de simulação**: qualquer venda paga com
M-Pesa ou e-Mola é aceite automaticamente, sem contactar nenhum servidor
externo — assim consegue testar e demonstrar o sistema sem ter contas
comerciais ainda.

**M-Pesa (Vodacom):**
1. Registe-se no portal de desenvolvedores M-Pesa da Vodacom Moçambique.
2. Vai receber: Application Key, Chave Pública e Service Provider Code (Agent ID).
3. Preencha `MPESA_API_KEY`, `MPESA_PUBLIC_KEY` e `MPESA_SERVICE_PROVIDER_CODE`
   no `.env` do backend.
4. Confirme no PDF de documentação que a Vodacom lhe entregar se os caminhos
   dos endpoints (`MPESA_PATH_SESSION`, `MPESA_PATH_C2B`) correspondem aos
   usados por omissão em `src/services/mpesa.service.js` — às vezes mudam
   entre versões da API.
5. Reinicie o backend. O sistema deteta automaticamente que já não está em
   simulação.

**e-Mola (Movitel):**
A Movitel não publica documentação pública — tem de contactá-los directamente
(departamento comercial/empresarial) para obter o endpoint e as credenciais.
Depois de as ter, preencha `EMOLA_API_URL`, `EMOLA_API_KEY` e
`EMOLA_MERCHANT_ID` no `.env`, e ajuste os nomes dos campos assinalados com
"AJUSTAR" em `src/services/emola.service.js` para corresponderem exactamente
ao que a Movitel indicar.

| GET    | `/api/dashboard/dre?ano=`           | Totais por categoria/mês para a DRE |
| GET/POST/DELETE | `/api/contas-pagar`        | Contas a pagar (fornecedores) |
| PATCH  | `/api/contas-pagar/:id/pagar`       | Marcar conta como paga (lança despesa) |
| GET/POST/DELETE | `/api/imobilizado`         | Imobilizado + depreciação calculada |
| GET/POST/DELETE | `/api/orcamento?ano=`      | Orçamento vs realizado |
| GET/PUT | `/api/irps/escaloes`               | Tabela de escalões de IRPS (editável) |
| POST   | `/api/irps/calcular`                | Calcula o IRPS de uma base tributável |
| GET/POST/DELETE | `/api/iva?periodo=`        | Livro de IVA (liquidado/dedutível) |

### Módulo Empresarial — nota importante sobre o IRPS

A tabela de escalões de IRPS **não vem pré-preenchida**. Há uma reforma fiscal (Lei
n.º 11/2025) em vigor desde Janeiro de 2026 que alterou os escalões, e os valores
exactos devem ser confirmados junto de um contabilista certificado ou da
Autoridade Tributária antes de usar em folhas de salário reais. O sistema permite
configurar/editar os escalões em **Módulo Empresarial → Folha de Salários**.

Todas as rotas (exceto `register`, `login` e `health`) exigem o cabeçalho:
```
Authorization: Bearer <token>
```

## 11. Segurança — resumo do que já está implementado

- Senhas nunca guardadas em texto simples (hash com `bcryptjs`)
- Sessões via JWT assinado com segredo próprio (`JWT_SECRET`)
- Isolamento por empresa: todas as consultas filtram por `empresa_id`, para que
  um utilizador nunca veja dados de outro negócio
- Limite de tentativas de login/registo (`express-rate-limit`)
- Cabeçalhos de segurança HTTP via `helmet`
- Transações atómicas do Postgres nas operações críticas (pagamento de cliente,
  movimentação de estoque) — evita inconsistências mesmo com pedidos simultâneos

## 12. Próximos passos sugeridos

1. Ligar o frontend (`contafacil-mz.html`) a esta API via `fetch`, guardando o
   token JWT (ex: em memória + `sessionStorage` no browser real, fora do
   ambiente de preview de artifacts).
2. Configurar backups automáticos do Postgres (`pg_dump` agendado via cron).
3. Adicionar relatórios de exportação no backend (hoje a exportação PDF/Excel
   é feita no frontend, no browser); mover para o servidor se precisar de
   relatórios agendados ou muito grandes.
4. Considerar filiais/múltiplas lojas por empresa, se o negócio crescer nesse
   sentido — o esquema atual já isola tudo por `empresa_id`, o que facilita
   essa evolução mais tarde.
