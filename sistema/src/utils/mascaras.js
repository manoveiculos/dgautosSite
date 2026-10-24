import { validarCPF, validarCNPJ, validarCpfCnpj } from '../store';

export function mascaraCpfCnpj(valor) {
  if (!valor) return '';
  const digits = String(valor).replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function mascaraTelefone(valor) {
  if (!valor) return '';
  const digits = String(valor).replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    // (00) 0000-0000
    return digits
      .replace(/^(\d{2})(\d)/g, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  // (00) 00000-0000
  return digits
    .replace(/^(\d{2})(\d)/g, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

export function mascaraCep(valor) {
  if (!valor) return '';
  const digits = String(valor).replace(/\D/g, '').slice(0, 8);
  return digits.replace(/(\d{5})(\d)/, '$1-$2');
}

export async function buscarCep(cep) {
  const limpo = String(cep).replace(/\D/g, '');
  if (limpo.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return {
      logradouro: (data.logradouro || '').toUpperCase(),
      bairro: (data.bairro || '').toUpperCase(),
      cidade: (data.localidade || '').toUpperCase(),
      uf: (data.uf || '').toUpperCase(),
      cidadeEstado: `${(data.localidade || '').toUpperCase()} / ${(data.uf || '').toUpperCase()}`
    };
  } catch (err) {
    console.warn('Erro ao consultar ViaCEP:', err);
    return null;
  }
}

export function mascaraMoeda(valor) {
  if (valor === '' || valor === null || valor === undefined) return '';
  if (typeof valor === 'number') {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  const digits = String(valor).replace(/\D/g, '');
  if (!digits) return '';
  const num = Number(digits) / 100;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function desformatarMoeda(valor) {
  if (typeof valor === 'number') return isNaN(valor) ? 0 : valor;
  if (!valor) return 0;
  const digits = String(valor).replace(/\D/g, '');
  if (!digits) return 0;
  return Number(digits) / 100;
}

export function formatarMoedaBRL(valor) {
  if (valor === '' || valor === null || valor === undefined) return 'R$ 0,00';
  const num = typeof valor === 'number' ? valor : desformatarMoeda(valor);
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export async function buscarCnpj(cnpj) {
  const limpo = String(cnpj).replace(/\D/g, '');
  if (limpo.length !== 14) return null;

  // Tentativa 1: open.cnpja.com
  try {
    const res = await fetch(`https://open.cnpja.com/office/${limpo}`);
    if (res.ok) {
      const d = await res.json();
      const end = d.address?.street || '';
      return {
        nome: (d.company?.name || d.alias || '').toUpperCase(),
        apelido: (d.alias || d.company?.name || '').toUpperCase(),
        logradouro: end.toUpperCase(),
        numero: String(d.address?.number || '').toUpperCase(),
        complemento: (d.address?.details || '').toUpperCase(),
        bairro: (d.address?.district || '').toUpperCase(),
        cidade: (d.address?.city || '').toUpperCase(),
        uf: (d.address?.state || 'SC').toUpperCase(),
        cidadeEstado: `${(d.address?.city || '').toUpperCase()} / ${(d.address?.state || 'SC').toUpperCase()}`,
        cep: mascaraCep(d.address?.zip || ''),
        telefone: d.phones?.[0] ? mascaraTelefone(`${d.phones[0].area}${d.phones[0].number}`) : '',
        email: (d.emails?.[0]?.address || '').toLowerCase(),
        data_abertura: d.founded || ''
      };
    }
  } catch {}

  // Tentativa 2: minhareceita.org
  try {
    const res = await fetch(`https://minhareceita.org/${limpo}`);
    if (res.ok) {
      const d = await res.json();
      const end = d.logradouro ? `${d.descricao_tipo_de_logradouro || ''} ${d.logradouro}`.trim() : '';
      return {
        nome: (d.razao_social || d.nome_fantasia || '').toUpperCase(),
        apelido: (d.nome_fantasia || '').toUpperCase(),
        logradouro: end.toUpperCase(),
        numero: String(d.numero || '').toUpperCase(),
        complemento: (d.complemento || '').toUpperCase(),
        bairro: (d.bairro || '').toUpperCase(),
        cidade: (d.municipio || '').toUpperCase(),
        uf: (d.uf || 'SC').toUpperCase(),
        cidadeEstado: `${(d.municipio || '').toUpperCase()} / ${(d.uf || 'SC').toUpperCase()}`,
        cep: mascaraCep(d.cep || ''),
        telefone: d.ddd_telefone_1 ? mascaraTelefone(d.ddd_telefone_1) : '',
        email: (d.email || '').toLowerCase(),
        data_abertura: d.data_inicio_atividade || ''
      };
    }
  } catch {}

  return null;
}

export { validarCPF, validarCNPJ, validarCpfCnpj };
