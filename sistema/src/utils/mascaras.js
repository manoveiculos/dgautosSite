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

// Formata placa no padrão Mercosul ou Antigo (ex: ABC1D23 ou ABC-1234)
export function mascaraPlaca(v) {
  if (!v) return '';
  return String(v).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
}

// Consulta de Placa via API Nacional / WDAPI2 / Backend DG Autos
export async function buscarPlaca(placa) {
  const limpo = String(placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
  if (!/^[A-Z]{3}[0-9][0-9A-Z][0-9]{2}$/.test(limpo)) return null;

  // 1. Tenta API do servidor Express (/api/placa/:placa)
  try {
    const res = await fetch(`/api/placa/${limpo}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.ok && data.veiculo) {
        const v = data.veiculo;
        return {
          marca: (v.marca || '').toUpperCase(),
          modelo: (v.modelo || '').toUpperCase(),
          versao: (v.versao || '').toUpperCase(),
          ano: v.ano || '',
          ano_modelo: v.ano || '',
          cor: (v.cor || '').toUpperCase(),
          combustivel: (v.combustivel || '').toUpperCase(),
          municipio: (v.municipio || '').toUpperCase(),
          uf: (v.uf || '').toUpperCase(),
          fipeValor: v.fipeValor || '',
          logo: v.logo || ''
        };
      }
    }
  } catch {}

  // 2. Fallback direto via token do provedor wdapi2
  try {
    const token = '97e59dd0a4790f25a020ca4623f9a902';
    const res = await fetch(`https://wdapi2.com.br/consulta/${limpo}/${token}`);
    if (res.ok) {
      const data = await res.json();
      if (data && (data.marca || data.MARCA)) {
        let fipeValor = '';
        let versaoFipe = '';
        const fipeList = data?.fipe?.dados;
        if (Array.isArray(fipeList) && fipeList.length) {
          const best = [...fipeList].sort((a, b) => (b?.score || 0) - (a?.score || 0))[0];
          fipeValor = best?.texto_valor || '';
          versaoFipe = best?.texto_modelo || '';
        }
        return {
          marca: (data.marca || data.MARCA || '').toUpperCase(),
          modelo: (data.modelo || data.MODELO || '').toUpperCase(),
          versao: (versaoFipe || data.VERSAO || data.SUBMODELO || '').toUpperCase(),
          ano: data.ano || data.anoModelo || '',
          ano_modelo: data.anoModelo || data.ano || '',
          cor: (data.cor || '').toUpperCase(),
          combustivel: (data?.extra?.combustivel || data?.combustivel || '').toUpperCase(),
          municipio: (data.municipio || data?.extra?.municipio || '').toUpperCase(),
          uf: (data.uf || data?.extra?.uf_placa || '').toUpperCase(),
          fipeValor,
          chassi: (data.chassi || '').toUpperCase(),
          renavam: data.renavam || ''
        };
      }
    }
  } catch {}

  return null;
}


export { validarCPF, validarCNPJ, validarCpfCnpj };
