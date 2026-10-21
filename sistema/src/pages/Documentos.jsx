import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, FileText } from 'lucide-react';
import { getNegociacoes, getConfig, brl, dataBr } from '../store';

export default function Documentos() {
  const [params] = useSearchParams();
  const [negociacoes, setNegociacoes] = useState([]);
  const [loja, setLoja] = useState(null);
  const [negId, setNegId] = useState(params.get('negociacao') || '');
  const [modelo, setModelo] = useState('contrato'); // contrato | recibo | entrega | consignacao

  useEffect(() => {
    getNegociacoes().then((ns) => {
      setNegociacoes(ns);
      if (!negId && ns.length) setNegId(String(ns[0].id));
    }).catch(() => {});
    getConfig().then((c) => setLoja(c.loja)).catch(() => {});
  }, []);

  const neg = useMemo(
    () => negociacoes.find((n) => String(n.id) === String(negId)) || negociacoes[0] || null,
    [negociacoes, negId]
  );

  const valorLiquido = neg ? Number(neg.valor_veiculo || 0) - Number(neg.desconto || 0) : 0;

  return (
    <>
      <header className="topbar no-print">
        <div>
          <h1>Documentos, Contratos & Recibos</h1>
          <p>Emissão instantânea preenchida com os dados da negociação, cliente e veículo.</p>
        </div>
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={16} />Imprimir / Salvar PDF
        </button>
      </header>

      <div className="toolbar no-print">
        <div className="field" style={{ minWidth: 320 }}>
          <label>Selecionar Negociação</label>
          <select className="select" value={neg?.id || ''} onChange={(e) => setNegId(e.target.value)}>
            {negociacoes.map((n) => (
              <option key={n.id} value={n.id}>
                #{n.id} — {n.cliente_nome || 'Cliente'} · {n.veic_marca} {n.veic_modelo} ({brl(n.valor_veiculo - (n.desconto || 0))})
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Modelo de Documento</label>
          <div className="tabs">
            <button className={`tab ${modelo === 'contrato' ? 'active' : ''}`} onClick={() => setModelo('contrato')}>
              <FileText size={14} />Contrato de Compra e Venda
            </button>
            <button className={`tab ${modelo === 'recibo' ? 'active' : ''}`} onClick={() => setModelo('recibo')}>
              <FileText size={14} />Recibo de Pagamento
            </button>
            <button className={`tab ${modelo === 'entrega' ? 'active' : ''}`} onClick={() => setModelo('entrega')}>
              <FileText size={14} />Termo de Entrega & Responsabilidade
            </button>
          </div>
        </div>
      </div>

      {!neg ? (
        <div className="card empty">Nenhuma negociação cadastrada para gerar documentos.</div>
      ) : (
        <div className="doc-preview">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', borderBottom: '2px solid #111827', paddingBottom: 14, marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: '1.35rem', margin: 0 }}>{loja?.nome_fantasia || 'DG Automóveis'}</h2>
              <div style={{ fontSize: '.82rem', color: '#4b5563' }}>
                {loja?.razao_social} · CNPJ: {loja?.cnpj}<br />
                {loja?.endereco} — {loja?.cidade}/{loja?.uf} · Tel: {loja?.telefone}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '.84rem' }}>
              <strong>NEGOCIAÇÃO Nº #{neg.id}</strong><br />
              Data: {dataBr(neg.data_fechamento || neg.data_negociacao)}
            </div>
          </div>

          {modelo === 'contrato' && (
            <>
              <h3 style={{ textAlign: 'center', textTransform: 'uppercase', marginBottom: 16 }}>
                CONTRATO PARTICULAR DE COMPRA E VENDA DE VEÍCULO AUTOMOTOR
              </h3>

              <div className="doc-box">
                <strong>VENDEDORA:</strong> {loja?.razao_social || 'DG Automóveis Ltda'}, inscrita no CNPJ sob nº {loja?.cnpj || '12.345.678/0001-90'}, estabelecida em {loja?.endereco}, {loja?.cidade}/{loja?.uf}.<br />
                <strong>COMPRADOR(A):</strong> <strong>{neg.cliente_nome || '______________________'}</strong>, inscrito(a) no CPF/CNPJ sob nº <strong>{neg.cliente_cpf_cnpj || '___.___.___-__'}</strong>, telefone {neg.cliente_telefone || '__________'}, residente e domiciliado(a) em {neg.cliente_endereco || '________________'}, {neg.cliente_cidade || ''}/{neg.cliente_uf || 'SC'}.
              </div>

              <div className="doc-box">
                <strong>CLÁUSULA 1ª — DO OBJETO (VEÍCULO VENDIDO):</strong><br />
                Marca/Modelo: <strong>{neg.veic_marca} {neg.veic_modelo}</strong> · Ano: <strong>{neg.veic_ano}</strong> · Cor: <strong>{neg.veic_cor || '—'}</strong><br />
                Placa: <strong>{neg.veic_placa || '—'}</strong> · Chassi: <strong>{neg.veic_chassi || '—'}</strong> · Renavam: <strong>{neg.veic_renavam || '—'}</strong> · Odômetro: <strong>{Number(neg.veic_km || 0).toLocaleString('pt-BR')} km</strong>.
              </div>

              <div className="doc-box">
                <strong>CLÁUSULA 2ª — DO PREÇO E DA FORMA DE PAGAMENTO:</strong><br />
                O veículo objeto deste contrato é negociado pelo valor líquido e certo de <strong>{brl(valorLiquido)}</strong>{neg.desconto > 0 ? ` (Valor de tabela ${brl(neg.valor_veiculo)} com desconto de ${brl(neg.desconto)})` : ''}, pago da seguinte forma:
                <ul style={{ paddingLeft: 20, marginTop: 6 }}>
                  {(neg.pagamentos || []).map((p, idx) => (
                    <li key={idx}>
                      <strong>{p.forma}</strong> ({p.financeira || 'Direto'}): <strong>{brl(p.valor)}</strong>
                    </li>
                  ))}
                </ul>
                {neg.troca_modelo && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #9ca3af' }}>
                    <strong>VEÍCULO DADO EM PAGAMENTO (TROCA):</strong> {neg.troca_marca} {neg.troca_modelo}, Ano {neg.troca_ano}, Placa {neg.troca_placa || '—'}, KM {Number(neg.troca_km || 0).toLocaleString('pt-BR')}, avaliado em <strong>{brl(neg.troca_valor)}</strong>, livre e desembaraçado de quaisquer ônus, multas ou restrições até a presente data.
                  </div>
                )}
              </div>

              <div className="doc-box">
                <strong>CLÁUSULA 3ª — DA GARANTIA E VISTORIA:</strong><br />
                {loja?.termos_garantia || 'Garantia legal de 90 (noventa) dias para motor e câmbio conforme Art. 26 do CDC.'}
              </div>

              {neg.observacoes && (
                <div className="doc-box">
                  <strong>CLÁUSULA 4ª — OBSERVAÇÕES ESPECÍFICAS:</strong><br />
                  {neg.observacoes}
                </div>
              )}
            </>
          )}

          {modelo === 'recibo' && (
            <>
              <h3 style={{ textAlign: 'center', textTransform: 'uppercase', marginBottom: 16 }}>
                RECIBO DE PAGAMENTO — {brl(valorLiquido)}
              </h3>
              <p style={{ marginBottom: 16 }}>
                Recebemos de <strong>{neg.cliente_nome || '______________________'}</strong>, inscrito(a) no CPF/CNPJ nº <strong>{neg.cliente_cpf_cnpj || '___.___.___-__'}</strong>, a importância total de <strong>{brl(valorLiquido)}</strong> referente à aquisição do veículo <strong>{neg.veic_marca} {neg.veic_modelo}</strong>, Ano <strong>{neg.veic_ano}</strong>, Placa <strong>{neg.veic_placa || '—'}</strong>, Chassi <strong>{neg.veic_chassi || '—'}</strong>.
              </p>
              <div className="doc-box">
                <strong>Detalhamento dos Valores Recebidos:</strong>
                <ul style={{ paddingLeft: 20, marginTop: 6 }}>
                  {(neg.pagamentos || []).map((p, idx) => (
                    <li key={idx}>{p.forma} ({p.financeira || 'À vista'}): <strong>{brl(p.valor)}</strong></li>
                  ))}
                </ul>
              </div>
              <p style={{ marginTop: 14 }}>
                Pelo que firmamos o presente recibo para que produza seus efeitos legais, condicionada a quitação final à efetiva compensação bancária de eventuais financiamentos, cheques ou transferências.
              </p>
            </>
          )}

          {modelo === 'entrega' && (
            <>
              <h3 style={{ textAlign: 'center', textTransform: 'uppercase', marginBottom: 16 }}>
                TERMO DE ENTREGA DE VEÍCULO E RESPONSABILIDADE CIVIL / CRIMINAL
              </h3>
              <p>
                Declaro para os devidos fins de direito que recebi nesta data, após vistoria e conferência presencial, o veículo <strong>{neg.veic_marca} {neg.veic_modelo}</strong>, Placa <strong>{neg.veic_placa || '—'}</strong>, Chassi <strong>{neg.veic_chassi || '—'}</strong>, Renavam <strong>{neg.veic_renavam || '—'}</strong>, com <strong>{Number(neg.veic_km || 0).toLocaleString('pt-BR')} km</strong> marcados no hodômetro, assumindo a partir deste ato inteira responsabilidade civil, administrativa e criminal pelo uso do veículo, inclusive multas de trânsito, pedágios e tributos gerados a partir desta data e horário, comprometendo-me a efetuar a transferência de propriedade junto ao DETRAN no prazo legal de 30 (trinta) dias.
              </p>
            </>
          )}

          <p style={{ marginTop: 24, textAlign: 'right' }}>
            {loja?.cidade || 'Balneário Camboriú'}/{loja?.uf || 'SC'}, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.
          </p>

          <div className="doc-sign-grid">
            <div className="doc-sign-line">
              {loja?.nome_fantasia || 'DG Automóveis'}<br />
              <small style={{ fontWeight: 400, color: '#4b5563' }}>Vendedora ({loja?.cnpj})</small>
            </div>
            <div className="doc-sign-line">
              {neg.cliente_nome || 'Comprador(a)'}<br />
              <small style={{ fontWeight: 400, color: '#4b5563' }}>Comprador(a) ({neg.cliente_cpf_cnpj || 'CPF/CNPJ'})</small>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
