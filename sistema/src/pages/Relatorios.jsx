import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3, TrendingUp, DollarSign, Car, Wrench, FileSpreadsheet,
  Printer, Calendar, Filter, Download, ArrowUpRight, ArrowDownRight,
  Clock, Building2, ShieldAlert, CheckCircle2, RefreshCw, Users, AlertTriangle
} from 'lucide-react';
import {
  getVeiculos, getNegociacoes, getClientes, getLancamentos,
  getUsuarios, getConfig, brl, dataBr
} from '../store';

export default function Relatorios({ user }) {
  const [tab, setTab] = useState('vendas'); // 'vendas' | 'estoque' | 'oficina'
  const [loading, setLoading] = useState(true);

  // Dados brutos
  const [veiculos, setVeiculos] = useState([]);
  const [negociacoes, setNegociacoes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [configLoja, setConfigLoja] = useState({});

  // Filtros - Vendas
  const [filtroPeriodoVendas, setFiltroPeriodoVendas] = useState('mes_atual');
  const [dataInicioVendas, setDataInicioVendas] = useState('');
  const [dataFimVendas, setDataFimVendas] = useState('');
  const [filtroVendedor, setFiltroVendedor] = useState('');

  // Filtros - Estoque
  const [filtroStatusEstoque, setFiltroStatusEstoque] = useState('em_estoque'); // 'em_estoque' | 'todos' | 'preparacao'
  const [filtroAgingEstoque, setFiltroAgingEstoque] = useState('todos'); // 'todos' | 'ate30' | '31a60' | '61a90' | 'mais90'

  // Filtros - Oficina
  const [filtroPeriodoOficina, setFiltroPeriodoOficina] = useState('mes_atual');
  const [filtroFornecedorOficina, setFiltroFornecedorOficina] = useState('');

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [v, n, c, l, u, cfg] = await Promise.all([
        getVeiculos(),
        getNegociacoes(),
        getClientes(),
        getLancamentos(),
        getUsuarios(),
        getConfig()
      ]);
      setVeiculos(v || []);
      setNegociacoes(n || []);
      setClientes(c || []);
      setLancamentos(l || []);
      setUsuarios(u || []);
      setConfigLoja(cfg || {});
    } catch (e) {
      console.error('Erro ao carregar relatórios:', e);
    } finally {
      setLoading(false);
    }
  };

  // HELPERS DE DATA
  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
  const primeiroDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).toISOString().slice(0, 10);
  const ultimoDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0).toISOString().slice(0, 10);
  const noventaDiasAtras = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const primeiroDiaAno = new Date(hoje.getFullYear(), 0, 1).toISOString().slice(0, 10);

  // 1. RELATÓRIO DE VENDAS & MARGEM LÍQUIDA
  const relatorioVendas = useMemo(() => {
    // Vendas concluídas ou ativas
    const vendasValidas = negociacoes.filter((n) => {
      const st = String(n.status || '').toLowerCase();
      const tp = String(n.tipo || '').toLowerCase();
      // Considerar apenas vendas (não compras avulsas da loja)
      const isVenda = tp === 'venda' || tp === 'venda_troca' || (!tp && n.valor_veiculo);
      const isConcluida = st === 'concluida' || st === 'aprovada' || st === 'entregue' || st === 'ganho';
      return isVenda && isConcluida;
    });

    const filtradas = vendasValidas.filter((n) => {
      const dataVenda = (n.data_venda || n.data_criacao || n.created_at || '').slice(0, 10);

      // Filtro de período
      if (filtroPeriodoVendas === 'mes_atual') {
        if (dataVenda < primeiroDiaMes || dataVenda > ultimoDiaMes) return false;
      } else if (filtroPeriodoVendas === 'mes_anterior') {
        if (dataVenda < primeiroDiaMesAnterior || dataVenda > ultimoDiaMesAnterior) return false;
      } else if (filtroPeriodoVendas === '90dias') {
        if (dataVenda < noventaDiasAtras) return false;
      } else if (filtroPeriodoVendas === 'ano_atual') {
        if (dataVenda < primeiroDiaAno) return false;
      } else if (filtroPeriodoVendas === 'personalizado') {
        if (dataInicioVendas && dataVenda < dataInicioVendas) return false;
        if (dataFimVendas && dataVenda > dataFimVendas) return false;
      }

      // Filtro vendedor
      if (filtroVendedor) {
        const vend = String(n.vendedor_nome || n.vendedor || '').toLowerCase();
        if (!vend.includes(filtroVendedor.toLowerCase())) return false;
      }

      return true;
    });

    // Mapear cada linha com custo real, despesas e lucro
    const linhas = filtradas.map((n) => {
      const veic = veiculos.find((v) => v.id === n.veiculo_id) || {};
      const despVeic = lancamentos
        .filter((l) => l.veiculo_id === veic.id && l.tipo === 'despesa')
        .reduce((acc, cur) => acc + Number(cur.valor || 0), 0);

      const custoAquisicao = Number(veic.custo || n.custo_veiculo || 0);
      const custoPreparacao = Number(veic.despesas_veiculo || despVeic || 0);
      const custoTotal = custoAquisicao + custoPreparacao;
      const valorVenda = Number(n.valor_veiculo || n.valor_total || veic.preco || 0);
      const lucroBruto = valorVenda - custoTotal;
      const margemPerc = custoTotal > 0 ? (lucroBruto / custoTotal) * 100 : 0;
      const comissao = Number(n.comissao_vendedor || 0);
      const lucroLiquido = lucroBruto - comissao;

      return {
        id: n.id,
        data: (n.data_venda || n.data_criacao || n.created_at || '').slice(0, 10),
        veiculo_nome: `${veic.marca || n.veiculo_marca || ''} ${veic.modelo || n.veiculo_modelo || ''}`.trim() || 'Veículo Não Identificado',
        placa: veic.placa || n.veiculo_placa || '-',
        cliente_nome: n.cliente_nome || 'Cliente Balcão',
        vendedor_nome: n.vendedor_nome || n.vendedor || 'Direto Loja',
        custo_aquisicao: custoAquisicao,
        custo_preparacao: custoPreparacao,
        custo_total: custoTotal,
        valor_venda: valorVenda,
        lucro_bruto: lucroBruto,
        margem_perc: margemPerc,
        comissao: comissao,
        lucro_liquido: lucroLiquido,
        forma_pagamento: n.forma_pagamento || n.tipo_pagamento || 'À Vista / Financiado'
      };
    });

    // Totais Consolidados
    const totalVendas = linhas.reduce((s, l) => s + l.valor_venda, 0);
    const totalCustoAquisicao = linhas.reduce((s, l) => s + l.custo_aquisicao, 0);
    const totalPreparacao = linhas.reduce((s, l) => s + l.custo_preparacao, 0);
    const totalCMV = linhas.reduce((s, l) => s + l.custo_total, 0);
    const totalLucroBruto = linhas.reduce((s, l) => s + l.lucro_bruto, 0);
    const totalComissoes = linhas.reduce((s, l) => s + l.comissao, 0);
    const totalLucroLiquido = linhas.reduce((s, l) => s + l.lucro_liquido, 0);
    const margemMedia = totalCMV > 0 ? (totalLucroBruto / totalCMV) * 100 : 0;
    const ticketMedio = linhas.length > 0 ? totalVendas / linhas.length : 0;

    return {
      linhas,
      totalVendas,
      totalCustoAquisicao,
      totalPreparacao,
      totalCMV,
      totalLucroBruto,
      totalComissoes,
      totalLucroLiquido,
      margemMedia,
      ticketMedio,
      qtd: linhas.length
    };
  }, [negociacoes, veiculos, lancamentos, filtroPeriodoVendas, dataInicioVendas, dataFimVendas, filtroVendedor]);

  // 2. RELATÓRIO DE ESTOQUE VALORIZADO & GIRO (CURVA ABC)
  const relatorioEstoque = useMemo(() => {
    let filtrados = veiculos.filter((v) => {
      const st = String(v.status || '').toLowerCase();
      if (filtroStatusEstoque === 'em_estoque') {
        return st === 'disponivel' || st === 'em_estoque' || st === 'preparacao' || st === 'reservado';
      } else if (filtroStatusEstoque === 'preparacao') {
        return st === 'preparacao';
      }
      return true; // 'todos'
    });

    // Mapear cada veículo
    const linhas = filtrados.map((v) => {
      const desp = lancamentos
        .filter((l) => l.veiculo_id === v.id && l.tipo === 'despesa')
        .reduce((acc, cur) => acc + Number(cur.valor || 0), 0);

      const custoAquisicao = Number(v.custo || 0);
      const custoPreparacao = Number(v.despesas_veiculo || desp || 0);
      const custoTotal = custoAquisicao + custoPreparacao;
      const precoVenda = Number(v.preco || 0);
      const valorFipe = Number(v.fipe || v.valor_fipe || 0);
      const lucroProjetado = precoVenda - custoTotal;
      const margemProjetada = custoTotal > 0 ? (lucroProjetado / custoTotal) * 100 : 0;

      // Calcular dias em pátio (Aging)
      const dataEntrada = v.data_entrada || v.created_at || new Date().toISOString().slice(0, 10);
      const dtE = new Date(dataEntrada);
      const diffMs = Date.now() - dtE.getTime();
      const diasPatio = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24))) || 0;

      let faixaAging = '<30d';
      if (diasPatio > 90) faixaAging = '>90d';
      else if (diasPatio > 60) faixaAging = '61-90d';
      else if (diasPatio > 30) faixaAging = '31-60d';

      return {
        id: v.id,
        placa: v.placa || '-',
        veiculo_nome: `${v.marca || ''} ${v.modelo || ''} ${v.versao || ''}`.trim(),
        ano: `${v.ano_modelo || v.ano || ''}`,
        cor: v.cor || '-',
        status: v.status || 'disponivel',
        dias_patio: diasPatio,
        faixa_aging: faixaAging,
        custo_aquisicao: custoAquisicao,
        custo_preparacao: custoPreparacao,
        custo_total: custoTotal,
        valor_fipe: valorFipe,
        preco_venda: precoVenda,
        lucro_projetado: lucroProjetado,
        margem_projetada: margemProjetada
      };
    });

    // Aplicar filtro de Aging
    const linhasFiltradas = linhas.filter((l) => {
      if (filtroAgingEstoque === 'ate30') return l.dias_patio <= 30;
      if (filtroAgingEstoque === '31a60') return l.dias_patio > 30 && l.dias_patio <= 60;
      if (filtroAgingEstoque === '61a90') return l.dias_patio > 60 && l.dias_patio <= 90;
      if (filtroAgingEstoque === 'mais90') return l.dias_patio > 90;
      return true;
    });

    // Consolidados
    const totalCustoEstoque = linhasFiltradas.reduce((s, l) => s + l.custo_total, 0);
    const totalFipeEstoque = linhasFiltradas.reduce((s, l) => s + l.valor_fipe, 0);
    const totalVendaProjetada = linhasFiltradas.reduce((s, l) => s + l.preco_venda, 0);
    const totalLucroProjetado = totalVendaProjetada - totalCustoEstoque;
    const mediaDiasPatio = linhasFiltradas.length > 0
      ? Math.round(linhasFiltradas.reduce((s, l) => s + l.dias_patio, 0) / linhasFiltradas.length)
      : 0;

    const contagemAging = {
      ate30: linhas.filter((l) => l.dias_patio <= 30).length,
      de31a60: linhas.filter((l) => l.dias_patio > 30 && l.dias_patio <= 60).length,
      de61a90: linhas.filter((l) => l.dias_patio > 60 && l.dias_patio <= 90).length,
      mais90: linhas.filter((l) => l.dias_patio > 90).length
    };

    return {
      linhas: linhasFiltradas,
      totalCustoEstoque,
      totalFipeEstoque,
      totalVendaProjetada,
      totalLucroProjetado,
      mediaDiasPatio,
      contagemAging,
      qtd: linhasFiltradas.length
    };
  }, [veiculos, lancamentos, filtroStatusEstoque, filtroAgingEstoque]);

  // 3. RELATÓRIO DE DESPESAS DE OFICINA & PREPARAÇÃO
  const relatorioOficina = useMemo(() => {
    // Lançamentos do tipo despesa com veículo vinculado ou categoria oficina/preparação/garantia
    const despesas = lancamentos.filter((l) => {
      if (l.tipo !== 'despesa') return false;
      const desc = String(l.descricao || '').toLowerCase();
      const cat = String(l.categoria || '').toLowerCase();
      const temCarro = Boolean(l.veiculo_id);
      const isOficina = cat.includes('oficina') || cat.includes('manuten') || cat.includes('prepara') ||
        cat.includes('funilaria') || cat.includes('estetica') || cat.includes('garantia') ||
        desc.includes('oficina') || desc.includes('mecânica') || desc.includes('funilaria') ||
        desc.includes('reparo') || desc.includes('garantia') || temCarro;
      return isOficina;
    });

    const filtradas = despesas.filter((l) => {
      const dataL = (l.data_quitacao || l.vencimento || l.emissao || l.data_pagamento || l.data_vencimento || l.created_at || '').slice(0, 10);

      if (filtroPeriodoOficina === 'mes_atual') {
        if (dataL < primeiroDiaMes || dataL > ultimoDiaMes) return false;
      } else if (filtroPeriodoOficina === 'mes_anterior') {
        if (dataL < primeiroDiaMesAnterior || dataL > ultimoDiaMesAnterior) return false;
      } else if (filtroPeriodoOficina === '90dias') {
        if (dataL < noventaDiasAtras) return false;
      } else if (filtroPeriodoOficina === 'ano_atual') {
        if (dataL < primeiroDiaAno) return false;
      }

      if (filtroFornecedorOficina) {
        const forn = String(l.cliente_nome || l.fornecedor || l.favorecido || l.cliente_fornecedor_nome || '').toLowerCase();
        if (!forn.includes(filtroFornecedorOficina.toLowerCase())) return false;
      }

      return true;
    });

    // Mapear linhas
    const linhas = filtradas.map((l) => {
      const veic = veiculos.find((v) => v.id === l.veiculo_id) || {};
      return {
        id: l.id,
        data: (l.data_quitacao || l.vencimento || l.emissao || l.data_pagamento || l.created_at || '').slice(0, 10),
        descricao: l.descricao || 'Despesa de Oficina / Preparação',
        categoria: l.categoria || 'Oficina / Preparação',
        fornecedor: l.cliente_nome || l.fornecedor || l.favorecido || l.cliente_fornecedor_nome || 'Oficina Parceira',
        veiculo_nome: veic.modelo ? `${veic.marca || ''} ${veic.modelo} (${veic.placa || '-'})` : 'Geral / Oficina',
        valor: Number(l.valor || 0),
        status: l.status || 'pago'
      };
    });

    // Agrupar por Fornecedor
    const fornecedoresMap = {};
    linhas.forEach((l) => {
      const nome = l.fornecedor || 'Diversos';
      if (!fornecedoresMap[nome]) {
        fornecedoresMap[nome] = { nome, total: 0, qtd: 0 };
      }
      fornecedoresMap[nome].total += l.valor;
      fornecedoresMap[nome].qtd += 1;
    });

    const rankingFornecedores = Object.values(fornecedoresMap).sort((a, b) => b.total - a.total);
    const totalGastoOficina = linhas.reduce((s, l) => s + l.valor, 0);

    return {
      linhas,
      rankingFornecedores,
      totalGastoOficina,
      qtd: linhas.length
    };
  }, [lancamentos, veiculos, filtroPeriodoOficina, filtroFornecedorOficina]);

  // EXPORTAÇÃO EXCEL (CSV UTF-8 BOM)
  const exportarExcel = () => {
    let nomeArquivo = '';
    let cabecalho = [];
    let dados = [];

    if (tab === 'vendas') {
      nomeArquivo = `Relatorio_Vendas_Margem_DGAUTOS_${hoje.toISOString().slice(0, 10)}.csv`;
      cabecalho = [
        'Data', 'Veiculo', 'Placa', 'Vendedor', 'Cliente',
        'Custo Aquisicao (R$)', 'Custo Preparacao (R$)', 'Custo Total Loja (R$)',
        'Valor Venda (R$)', 'Lucro Bruto (R$)', 'Margem (%)', 'Comissao (R$)', 'Lucro Liquido (R$)', 'Forma Pagamento'
      ];
      dados = relatorioVendas.linhas.map((l) => [
        dataBr(l.data),
        `"${l.veiculo_nome.replace(/"/g, '""')}"`,
        `"${l.placa}"`,
        `"${l.vendedor_nome.replace(/"/g, '""')}"`,
        `"${l.cliente_nome.replace(/"/g, '""')}"`,
        l.custo_aquisicao.toFixed(2),
        l.custo_preparacao.toFixed(2),
        l.custo_total.toFixed(2),
        l.valor_venda.toFixed(2),
        l.lucro_bruto.toFixed(2),
        l.margem_perc.toFixed(1) + '%',
        l.comissao.toFixed(2),
        l.lucro_liquido.toFixed(2),
        `"${l.forma_pagamento}"`
      ]);
    } else if (tab === 'estoque') {
      nomeArquivo = `Relatorio_Estoque_Valorizado_DGAUTOS_${hoje.toISOString().slice(0, 10)}.csv`;
      cabecalho = [
        'Placa', 'Veiculo', 'Ano', 'Cor', 'Status', 'Dias Patio', 'Faixa Aging',
        'Custo Aquisicao (R$)', 'Custo Preparacao (R$)', 'Custo Total (R$)',
        'Valor FIPE (R$)', 'Preco Venda (R$)', 'Lucro Projetado (R$)', 'Margem Projetada (%)'
      ];
      dados = relatorioEstoque.linhas.map((l) => [
        `"${l.placa}"`,
        `"${l.veiculo_nome.replace(/"/g, '""')}"`,
        `"${l.ano}"`,
        `"${l.cor}"`,
        `"${l.status}"`,
        l.dias_patio,
        `"${l.faixa_aging}"`,
        l.custo_aquisicao.toFixed(2),
        l.custo_preparacao.toFixed(2),
        l.custo_total.toFixed(2),
        l.valor_fipe.toFixed(2),
        l.preco_venda.toFixed(2),
        l.lucro_projetado.toFixed(2),
        l.margem_projetada.toFixed(1) + '%'
      ]);
    } else if (tab === 'oficina') {
      nomeArquivo = `Relatorio_Despesas_Oficina_DGAUTOS_${hoje.toISOString().slice(0, 10)}.csv`;
      cabecalho = ['Data', 'Descricao', 'Categoria', 'Fornecedor / Oficina', 'Veiculo', 'Valor (R$)', 'Status'];
      dados = relatorioOficina.linhas.map((l) => [
        dataBr(l.data),
        `"${l.descricao.replace(/"/g, '""')}"`,
        `"${l.categoria.replace(/"/g, '""')}"`,
        `"${l.fornecedor.replace(/"/g, '""')}"`,
        `"${l.veiculo_nome.replace(/"/g, '""')}"`,
        l.valor.toFixed(2),
        `"${l.status}"`
      ]);
    }

    const csvContent = '\uFEFF' + [
      cabecalho.join(';'),
      ...dados.map((row) => row.join(';'))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = nomeArquivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // IMPRESSÃO A4 OFICIAL
  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="fade-in" style={{ paddingBottom: 60 }}>
      {/* CABEÇALHO DA PÁGINA */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BarChart3 size={26} style={{ color: 'var(--primary)' }} />
            Central de Relatórios Gerenciais
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '.86rem' }}>
            Auditoria comercial, margem líquida real de vendas, capital imobilizado em estoque e custos de oficina.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportarExcel}
            title="Exportar dados da tabela ativa para Excel (formato .CSV com ponto-e-vírgula)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
          >
            <Download size={16} /> Exportar Excel (.CSV)
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleImprimir}
            title="Imprimir relatório oficial formatado em padrão A4"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Printer size={16} /> Imprimir Relatório (A4)
          </button>
        </div>
      </div>

      {/* NAVEGAÇÃO DE ABAS */}
      <div className="no-print tabs" style={{ marginBottom: 20, borderBottom: '2px solid var(--border)', display: 'flex', gap: 8 }}>
        <button
          type="button"
          className={`tab ${tab === 'vendas' ? 'active' : ''}`}
          onClick={() => setTab('vendas')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', fontWeight: 700 }}
        >
          <TrendingUp size={16} /> Vendas & Margem Líquida Real
        </button>
        <button
          type="button"
          className={`tab ${tab === 'estoque' ? 'active' : ''}`}
          onClick={() => setTab('estoque')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', fontWeight: 700 }}
        >
          <Car size={16} /> Estoque Valorizado & Curva de Giro
        </button>
        <button
          type="button"
          className={`tab ${tab === 'oficina' ? 'active' : ''}`}
          onClick={() => setTab('oficina')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', fontWeight: 700 }}
        >
          <Wrench size={16} /> Despesas de Oficina & Fornecedores
        </button>
      </div>

      {/* CABEÇALHO EXCLUSIVO PARA IMPRESSÃO A4 */}
      <div className="print-only" style={{ display: 'none', marginBottom: 20, borderBottom: '2px solid #0f172a', paddingBottom: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>DG AUTOMÓVEIS & VEÍCULOS</h2>
            <div style={{ fontSize: '.8rem', color: '#475569' }}>
              CNPJ: {configLoja.cnpj || '35.485.811/0001-44'} • Rio do Sul / SC
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: '.8rem', color: '#475569' }}>
            <strong>RELATÓRIO GERENCIAL OFICIAL</strong>
            <div>Emissão: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</div>
            <div>Emitido por: {user?.nome || 'Administração'}</div>
          </div>
        </div>
      </div>

      {/* CONTEÚDO DA ABA 1: VENDAS & MARGEM */}
      {tab === 'vendas' && (
        <div>
          {/* BARRA DE FILTROS */}
          <div className="card no-print" style={{ padding: '14px 18px', marginBottom: 20, background: '#f8fafc', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--muted)', fontSize: '.84rem' }}>
                <Filter size={15} /> Filtros:
              </div>

              <div>
                <select
                  className="input"
                  value={filtroPeriodoVendas}
                  onChange={(e) => setFiltroPeriodoVendas(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '.85rem' }}
                >
                  <option value="mes_atual">📅 Mês Atual ({hoje.toLocaleString('pt-BR', { month: 'long' })})</option>
                  <option value="mes_anterior">📅 Mês Anterior</option>
                  <option value="90dias">📅 Últimos 90 Dias</option>
                  <option value="ano_atual">📅 Ano Atual ({hoje.getFullYear()})</option>
                  <option value="todos">📅 Todo o Histórico</option>
                  <option value="personalizado">📅 Período Personalizado</option>
                </select>
              </div>

              {filtroPeriodoVendas === 'personalizado' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="date"
                    className="input"
                    value={dataInicioVendas}
                    onChange={(e) => setDataInicioVendas(e.target.value)}
                    style={{ padding: '5px 8px', fontSize: '.85rem' }}
                  />
                  <span style={{ fontSize: '.85rem', color: 'var(--muted)' }}>até</span>
                  <input
                    type="date"
                    className="input"
                    value={dataFimVendas}
                    onChange={(e) => setDataFimVendas(e.target.value)}
                    style={{ padding: '5px 8px', fontSize: '.85rem' }}
                  />
                </div>
              )}

              <div>
                <input
                  type="text"
                  className="input"
                  placeholder="Filtrar por Vendedor..."
                  value={filtroVendedor}
                  onChange={(e) => setFiltroVendedor(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '.85rem', width: 190 }}
                />
              </div>

              <div style={{ marginLeft: 'auto', fontSize: '.82rem', color: 'var(--muted)' }}>
                Exibindo <strong>{relatorioVendas.qtd}</strong> venda(s) realizada(s)
              </div>
            </div>
          </div>

          {/* CARDS RESUMO / KPIS */}
          <div className="grid grid-4" style={{ gap: 14, marginBottom: 20 }}>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #0284c7' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Faturado (Vendas)</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0284c7', marginTop: 4 }}>{brl(relatorioVendas.totalVendas)}</div>
              <div style={{ fontSize: '.76rem', color: 'var(--muted)', marginTop: 4 }}>{relatorioVendas.qtd} carros vendidos</div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>CMV Total (Custo dos Carros)</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#d97706', marginTop: 4 }}>{brl(relatorioVendas.totalCMV)}</div>
              <div style={{ fontSize: '.76rem', color: 'var(--muted)', marginTop: 4 }}>
                Prep: {brl(relatorioVendas.totalPreparacao)}
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Lucro Bruto Real</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: relatorioVendas.totalLucroBruto >= 0 ? '#10b981' : '#ef4444', marginTop: 4 }}>
                {brl(relatorioVendas.totalLucroBruto)}
              </div>
              <div style={{ fontSize: '.76rem', color: 'var(--muted)', marginTop: 4 }}>
                Margem Média: <strong style={{ color: '#10b981' }}>{relatorioVendas.margemMedia.toFixed(1)}%</strong>
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #6366f1' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Ticket Médio por Venda</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#6366f1', marginTop: 4 }}>{brl(relatorioVendas.ticketMedio)}</div>
              <div style={{ fontSize: '.76rem', color: 'var(--muted)', marginTop: 4 }}>
                Lucro Líq. pós-comissão: <strong>{brl(relatorioVendas.totalLucroLiquido)}</strong>
              </div>
            </div>
          </div>

          {/* TABELA DE VENDAS & MARGENS */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div className="table-responsive">
              <table className="table" style={{ margin: 0, fontSize: '.84rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                    <th>Data</th>
                    <th>Veículo Vendido</th>
                    <th>Placa</th>
                    <th>Vendedor</th>
                    <th>Cliente Comprador</th>
                    <th style={{ textAlign: 'right' }}>Custo Aquis.</th>
                    <th style={{ textAlign: 'right' }}>Prep./Oficina</th>
                    <th style={{ textAlign: 'right' }}>Custo Total</th>
                    <th style={{ textAlign: 'right' }}>Preço Venda</th>
                    <th style={{ textAlign: 'right' }}>Lucro Bruto</th>
                    <th style={{ textAlign: 'center' }}>Margem %</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorioVendas.linhas.length === 0 ? (
                    <tr>
                      <td colSpan={11} style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                        Nenhuma venda encontrada para o período selecionado.
                      </td>
                    </tr>
                  ) : (
                    relatorioVendas.linhas.map((l) => (
                      <tr key={l.id}>
                        <td>{dataBr(l.data)}</td>
                        <td><strong>{l.veiculo_nome}</strong></td>
                        <td><span className="badge" style={{ background: '#e2e8f0', color: '#1e293b', fontWeight: 700 }}>{l.placa}</span></td>
                        <td>{l.vendedor_nome}</td>
                        <td style={{ color: 'var(--muted)' }}>{l.cliente_nome}</td>
                        <td style={{ textAlign: 'right' }}>{brl(l.custo_aquisicao)}</td>
                        <td style={{ textAlign: 'right', color: l.custo_preparacao > 0 ? '#d97706' : 'var(--muted)' }}>{brl(l.custo_preparacao)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{brl(l.custo_total)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{brl(l.valor_venda)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: l.lucro_bruto >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {brl(l.lucro_bruto)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 800, color: l.margem_perc >= 10 ? '#10b981' : (l.margem_perc >= 0 ? '#d97706' : '#ef4444') }}>
                            {l.margem_perc.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {relatorioVendas.linhas.length > 0 && (
                  <tfoot style={{ background: '#f1f5f9', fontWeight: 800 }}>
                    <tr>
                      <td colSpan={5}>TOTAIS DO PERÍODO ({relatorioVendas.qtd} VENDAS)</td>
                      <td style={{ textAlign: 'right' }}>{brl(relatorioVendas.totalCustoAquisicao)}</td>
                      <td style={{ textAlign: 'right', color: '#d97706' }}>{brl(relatorioVendas.totalPreparacao)}</td>
                      <td style={{ textAlign: 'right' }}>{brl(relatorioVendas.totalCMV)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{brl(relatorioVendas.totalVendas)}</td>
                      <td style={{ textAlign: 'right', color: relatorioVendas.totalLucroBruto >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {brl(relatorioVendas.totalLucroBruto)}
                      </td>
                      <td style={{ textAlign: 'center', color: '#10b981' }}>{relatorioVendas.margemMedia.toFixed(1)}%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: ESTOQUE VALORIZADO & GIRO */}
      {tab === 'estoque' && (
        <div>
          {/* BARRA DE FILTROS */}
          <div className="card no-print" style={{ padding: '14px 18px', marginBottom: 20, background: '#f8fafc', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--muted)', fontSize: '.84rem' }}>
                <Filter size={15} /> Filtros de Estoque:
              </div>

              <div>
                <select
                  className="input"
                  value={filtroStatusEstoque}
                  onChange={(e) => setFiltroStatusEstoque(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '.85rem' }}
                >
                  <option value="em_estoque">🚗 No Pátio (Disponíveis + Preparação + Reservados)</option>
                  <option value="preparacao">🔧 Em Oficina / Preparação</option>
                  <option value="todos">Todos os Registros</option>
                </select>
              </div>

              <div>
                <select
                  className="input"
                  value={filtroAgingEstoque}
                  onChange={(e) => setFiltroAgingEstoque(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '.85rem' }}
                >
                  <option value="todos">⏳ Todas as Idades de Pátio</option>
                  <option value="ate30">🟢 Até 30 Dias (Giro Rápido)</option>
                  <option value="31a60">🟡 31 a 60 Dias (Normal)</option>
                  <option value="61a90">🟠 61 a 90 Dias (Atenção)</option>
                  <option value="mais90">🔴 Acima de 90 Dias (Travado)</option>
                </select>
              </div>

              <div style={{ marginLeft: 'auto', fontSize: '.82rem', color: 'var(--muted)' }}>
                Total: <strong>{relatorioEstoque.qtd}</strong> veículo(s) listado(s)
              </div>
            </div>
          </div>

          {/* RESUMO DE GIRO (AGING BADGES) */}
          <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            <div className="card" style={{ padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0' }}>
              <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#065f46' }}>Até 30 dias (Giro Rápido)</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#047857' }}>{relatorioEstoque.contagemAging.ate30} carros</div>
            </div>
            <div className="card" style={{ padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#1e40af' }}>31 a 60 dias (Normal)</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1d4ed8' }}>{relatorioEstoque.contagemAging.de31a60} carros</div>
            </div>
            <div className="card" style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a' }}>
              <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#92400e' }}>61 a 90 dias (Atenção)</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b45309' }}>{relatorioEstoque.contagemAging.de61a90} carros</div>
            </div>
            <div className="card" style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca' }}>
              <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#991b1b' }}>Mais de 90 dias (Giro Lento)</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>{relatorioEstoque.contagemAging.mais90} carros</div>
            </div>
          </div>

          {/* CARDS RESUMO / KPIS ESTOQUE */}
          <div className="grid grid-4" style={{ gap: 14, marginBottom: 20 }}>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Capital Investido no Pátio</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#dc2626', marginTop: 4 }}>{brl(relatorioEstoque.totalCustoEstoque)}</div>
              <div style={{ fontSize: '.76rem', color: 'var(--muted)', marginTop: 4 }}>Custo aquisição + preparação</div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Valor Tabela FIPE Total</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#2563eb', marginTop: 4 }}>{brl(relatorioEstoque.totalFipeEstoque)}</div>
              <div style={{ fontSize: '.76rem', color: 'var(--muted)', marginTop: 4 }}>Patrimônio FIPE atual</div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Valor de Venda Projetado</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#059669', marginTop: 4 }}>{brl(relatorioEstoque.totalVendaProjetada)}</div>
              <div style={{ fontSize: '.76rem', color: 'var(--muted)', marginTop: 4 }}>
                Lucro Projetado: <strong style={{ color: '#059669' }}>{brl(relatorioEstoque.totalLucroProjetado)}</strong>
              </div>
            </div>

            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Tempo Médio de Pátio</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#7c3aed', marginTop: 4 }}>{relatorioEstoque.mediaDiasPatio} dias</div>
              <div style={{ fontSize: '.76rem', color: 'var(--muted)', marginTop: 4 }}>Giro médio do estoque</div>
            </div>
          </div>

          {/* TABELA DE ESTOQUE VALORIZADO */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div className="table-responsive">
              <table className="table" style={{ margin: 0, fontSize: '.84rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                    <th>Placa</th>
                    <th>Veículo</th>
                    <th>Ano</th>
                    <th>Status</th>
                    <th>Tempo de Pátio</th>
                    <th style={{ textAlign: 'right' }}>Custo Aquis.</th>
                    <th style={{ textAlign: 'right' }}>Prep./Oficina</th>
                    <th style={{ textAlign: 'right' }}>Custo Total</th>
                    <th style={{ textAlign: 'right' }}>Tabela FIPE</th>
                    <th style={{ textAlign: 'right' }}>Preço Venda</th>
                    <th style={{ textAlign: 'right' }}>Lucro Proj.</th>
                    <th style={{ textAlign: 'center' }}>Margem %</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorioEstoque.linhas.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                        Nenhum veículo encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    relatorioEstoque.linhas.map((l) => {
                      let badgeColor = '#059669';
                      let badgeBg = '#ecfdf5';
                      if (l.dias_patio > 90) { badgeColor = '#dc2626'; badgeBg = '#fef2f2'; }
                      else if (l.dias_patio > 60) { badgeColor = '#b45309'; badgeBg = '#fffbeb'; }
                      else if (l.dias_patio > 30) { badgeColor = '#1d4ed8'; badgeBg = '#eff6ff'; }

                      return (
                        <tr key={l.id}>
                          <td><span className="badge" style={{ background: '#0f172a', color: '#fff', fontWeight: 700 }}>{l.placa}</span></td>
                          <td><strong>{l.veiculo_nome}</strong></td>
                          <td>{l.ano}</td>
                          <td><span className={`badge badge-${l.status}`}>{l.status}</span></td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, background: badgeBg, color: badgeColor, fontWeight: 700, fontSize: '.74rem' }}>
                              <Clock size={11} /> {l.dias_patio}d ({l.faixa_aging})
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>{brl(l.custo_aquisicao)}</td>
                          <td style={{ textAlign: 'right', color: l.custo_preparacao > 0 ? '#d97706' : 'var(--muted)' }}>{brl(l.custo_preparacao)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{brl(l.custo_total)}</td>
                          <td style={{ textAlign: 'right', color: '#2563eb' }}>{brl(l.valor_fipe)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{brl(l.preco_venda)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: l.lucro_projetado >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {brl(l.lucro_projetado)}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: l.margem_projetada >= 10 ? '#10b981' : '#d97706' }}>
                            {l.margem_projetada.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {relatorioEstoque.linhas.length > 0 && (
                  <tfoot style={{ background: '#f1f5f9', fontWeight: 800 }}>
                    <tr>
                      <td colSpan={5}>TOTAIS ({relatorioEstoque.qtd} VEÍCULOS NO PÁTIO)</td>
                      <td style={{ textAlign: 'right' }}>-</td>
                      <td style={{ textAlign: 'right' }}>-</td>
                      <td style={{ textAlign: 'right', color: '#dc2626' }}>{brl(relatorioEstoque.totalCustoEstoque)}</td>
                      <td style={{ textAlign: 'right', color: '#2563eb' }}>{brl(relatorioEstoque.totalFipeEstoque)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{brl(relatorioEstoque.totalVendaProjetada)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--success)' }}>{brl(relatorioEstoque.totalLucroProjetado)}</td>
                      <td style={{ textAlign: 'center' }}>-</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONTEÚDO DA ABA 3: DESPESAS DE OFICINA & FORNECEDORES */}
      {tab === 'oficina' && (
        <div>
          {/* BARRA DE FILTROS */}
          <div className="card no-print" style={{ padding: '14px 18px', marginBottom: 20, background: '#f8fafc', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--muted)', fontSize: '.84rem' }}>
                <Filter size={15} /> Filtros:
              </div>

              <div>
                <select
                  className="input"
                  value={filtroPeriodoOficina}
                  onChange={(e) => setFiltroPeriodoOficina(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '.85rem' }}
                >
                  <option value="mes_atual">📅 Mês Atual</option>
                  <option value="mes_anterior">📅 Mês Anterior</option>
                  <option value="90dias">📅 Últimos 90 Dias</option>
                  <option value="ano_atual">📅 Ano Atual ({hoje.getFullYear()})</option>
                  <option value="todos">📅 Todo o Histórico</option>
                </select>
              </div>

              <div>
                <input
                  type="text"
                  className="input"
                  placeholder="Filtrar por Fornecedor / Oficina..."
                  value={filtroFornecedorOficina}
                  onChange={(e) => setFiltroFornecedorOficina(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '.85rem', width: 230 }}
                />
              </div>

              <div style={{ marginLeft: 'auto', fontSize: '.82rem', color: 'var(--muted)' }}>
                Total: <strong>{relatorioOficina.qtd}</strong> despesa(s) de preparação / oficina
              </div>
            </div>
          </div>

          {/* RANKING DE OFICINAS PARCEIRAS */}
          <div className="grid grid-3" style={{ gap: 14, marginBottom: 20 }}>
            <div className="card" style={{ padding: '16px', borderLeft: '4px solid #f97316' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>Total em Oficina / Pré-Venda</div>
              <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#ea580c', marginTop: 4 }}>{brl(relatorioOficina.totalGastoOficina)}</div>
              <div style={{ fontSize: '.76rem', color: 'var(--muted)', marginTop: 4 }}>No período selecionado</div>
            </div>

            <div className="card" style={{ gridColumn: 'span 2', padding: '14px 18px' }}>
              <div style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 8 }}>
                Top Fornecedores / Mecânicas / Martelinho
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {relatorioOficina.rankingFornecedores.slice(0, 5).map((f, i) => (
                  <div key={i} style={{ background: '#f8fafc', padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', fontSize: '.8rem' }}>
                    <strong>{f.nome}</strong>: <span style={{ color: '#ea580c', fontWeight: 700 }}>{brl(f.total)}</span> ({f.qtd} OS)
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TABELA DE DESPESAS */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div className="table-responsive">
              <table className="table" style={{ margin: 0, fontSize: '.84rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                    <th>Data</th>
                    <th>Descrição do Serviço</th>
                    <th>Oficina / Prestador</th>
                    <th>Veículo Vinculado</th>
                    <th>Categoria</th>
                    <th style={{ textAlign: 'right' }}>Valor Gasto</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {relatorioOficina.linhas.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                        Nenhuma despesa de oficina ou preparação encontrada no período.
                      </td>
                    </tr>
                  ) : (
                    relatorioOficina.linhas.map((l) => (
                      <tr key={l.id}>
                        <td>{dataBr(l.data)}</td>
                        <td><strong>{l.descricao}</strong></td>
                        <td>{l.fornecedor}</td>
                        <td style={{ color: 'var(--primary)' }}>{l.veiculo_nome}</td>
                        <td><span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>{l.categoria}</span></td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: '#ea580c' }}>{brl(l.valor)}</td>
                        <td><span className={`badge badge-${l.status}`}>{l.status}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
                {relatorioOficina.linhas.length > 0 && (
                  <tfoot style={{ background: '#f1f5f9', fontWeight: 800 }}>
                    <tr>
                      <td colSpan={5}>TOTAL GASTO EM OFICINA / PREPARAÇÃO</td>
                      <td style={{ textAlign: 'right', color: '#ea580c' }}>{brl(relatorioOficina.totalGastoOficina)}</td>
                      <td>-</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
