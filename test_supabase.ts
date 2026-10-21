import { fetchPalpites } from './src/services/bolaoService';

async function main() {
  const p = await fetchPalpites();
  console.log(p.slice(0, 2));
}
main();
