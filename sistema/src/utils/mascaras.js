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

export { validarCPF, validarCNPJ, validarCpfCnpj };
