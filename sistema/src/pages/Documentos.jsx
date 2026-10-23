import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, FileText, CheckCircle2, ShieldCheck, DollarSign, Handshake, Save } from 'lucide-react';
import { getNegociacoes, getConfig, saveContratoGerado, getContratosGerados, brl, dataBr } from '../store';

const MODELOS_CONTRATO = [
  { id: 'venda_padrao', label: '1. Venda Padrão (LGPD)', sub: '10 Cláusulas · Transf. 30d, Comunicação, LGPD' },
  { id: 'venda_desconto', label: '2. Venda com Desconto', sub: '11 Cláusulas · Isenção Vício Oculto, Hodômetro, 20%' },
  { id: 'venda_completa', label: '3. Venda Completa CDC', sub: '18 Cláusulas · Vistoria, Garantia 90d/5000km, Multa 20%' },
  { id: 'compra_estoque', label: '4. Compra para Estoque', sub: '9 Cláusulas · Aquisição da Loja, Quitação, Procedência' },
  { id: 'consignacao', label: '5. Consignação & Serviços', sub: '8 Cláusulas · Tabela de Despesas, Prazo 60d, Exclusividade' },
  { id: 'recibo', label: '6. Recibo de Pagamento', sub: 'Quitação e discriminação de valores recebidos' },
  { id: 'entrega', label: '7. Termo de Entrega', sub: 'Responsabilidade Civil/Criminal pós-saída' },
];

export default function Documentos({ user }) {
  const [params] = useSearchParams();
  const [negociacoes, setNegociacoes] = useState([]);
  const [loja, setLoja] = useState(null);
  const [negId, setNegId] = useState(params.get('negociacao') || '');
  const [modelo, setModelo] = useState('venda_padrao');
  const [autorizaImagem, setAutorizaImagem] = useState(true);
  const [salvandoContrato, setSalvandoContrato] = useState(false);
  const [contratoGravado, setContratoGravado] = useState(null);

  useEffect(() => {
    getNegociacoes().then((ns) => {
      const arr = Array.isArray(ns) ? ns : [];
      setNegociacoes(arr);
      if (!negId && arr.length) setNegId(String(arr[0].id));
    }).catch(() => {});
    getConfig().then((c) => {
      if (c?.loja) setLoja(c.loja);
    }).catch(() => {});
  }, []);

  const neg = useMemo(() => {
    const arr = Array.isArray(negociacoes) ? negociacoes : [];
    return arr.find((n) => String(n.id) === String(negId)) || arr[0] || null;
  }, [negociacoes, negId]);

  useEffect(() => {
    if (neg) {
      if (neg.tipo === 'compra') setModelo('compra_estoque');
      else if (neg.tipo === 'consignacao') setModelo('consignacao');
    }
  }, [neg?.id, neg?.tipo]);

  useEffect(() => {
    if (neg?.id) {
      getContratosGerados(neg.id).then((regs) => {
        if (Array.isArray(regs) && regs.length > 0) {
          setContratoGravado(regs[0]);
        } else {
          setContratoGravado(null);
        }
      }).catch(() => {});
    }
  }, [neg?.id]);

  const veicObj = useMemo(() => {
    if (!neg) return {};
    const isCompraOuConsig = neg.tipo === 'compra' || neg.tipo === 'consignacao';
    return {
      marca: isCompraOuConsig ? (neg.troca_marca || neg.veic_marca || '') : (neg.veic_marca || neg.troca_marca || ''),
      modelo: isCompraOuConsig ? (neg.troca_modelo || neg.veic_modelo || '') : (neg.veic_modelo || neg.troca_modelo || ''),
      ano: isCompraOuConsig ? (neg.troca_ano || neg.veic_ano || '') : (neg.veic_ano || neg.troca_ano || ''),
      placa: isCompraOuConsig ? (neg.troca_placa || neg.veic_placa || '') : (neg.veic_placa || neg.troca_placa || ''),
      cor: neg.veic_cor || neg.troca_cor || 'Não informada',
      chassi: neg.veic_chassi || '—',
      renavam: neg.veic_renavam || '—',
      km: isCompraOuConsig ? (neg.troca_km || neg.veic_km || 0) : (neg.veic_km || 0),
    };
  }, [neg]);

  const gravarContrato = async () => {
    if (!neg) return alert('Selecione uma negociação antes de gerar o contrato.');
    setSalvandoContrato(true);
    try {
      const docElement = document.querySelector('.doc-preview');
      const texto = docElement ? docElement.innerText : '';
      const salvo = await saveContratoGerado({
        negociacao_id: neg.id,
        veiculo_id: neg.veiculo_id || null,
        cliente_id: neg.cliente_id || null,
        modelo_codigo: modelo,
        texto_integral: texto,
        autorizacao_lgpd_imagem: autorizaImagem,
        hodometro_comprado: Number(veicObj.km) || 0,
        hodometro_troca: Number(neg.troca_km) || 0,
        status: 'emitido'
      });
      setContratoGravado(salvo);
      alert(`✓ Contrato gravado com sucesso em contratos_gerados_DGAUTOS (Registro #${salvo?.id || 'OK'})!`);
    } catch (err) {
      alert(`Erro ao gravar contrato: ${err.message || 'Erro de conexão'}`);
    } finally {
      setSalvandoContrato(false);
    }
  };

  const valorLiquido = neg ? Number(neg.valor_veiculo || 0) - Number(neg.desconto || 0) : 0;
  const cidEmp = loja?.cidade || 'Rio do Sul';
  const sigEmp = loja?.uf || 'SC';
  const nomCli = neg?.cliente_nome || 'Cliente';
  const kmPrincipal = veicObj.km || neg?.veic_km || (neg?.tipo === 'compra' ? neg?.troca_km : 0);
  const qvnAut = kmPrincipal ? `${Number(kmPrincipal).toLocaleString('pt-BR')} km` : 'Não informado';
  const qcmvTr = neg?.tipo === 'troca'
    ? (neg?.troca_km ? `${Number(neg.troca_km).toLocaleString('pt-BR')} km` : (neg?.troca_modelo ? 'Hodômetro não informado' : 'Não se aplica (Sem veículo na troca)'))
    : 'Não se aplica (Operação direta)';
  const pagamentosLista = Array.isArray(neg?.pagamentos) ? neg.pagamentos : [];

  return (
    <>
      {salvandoContrato && (
        <div className="loading-toast">
          <div className="spinner-sm" />
          <span>Gravando contrato no banco de dados Supabase...</span>
        </div>
      )}
      <header className="topbar no-print">
        <div>
          <h1>Minutas & Contratos Oficiais — DG Automóveis</h1>
          <p>Emissão jurídica preenchida em tempo real com substituição de cláusulas, hodômetro, LGPD e foro.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            disabled={salvandoContrato || !neg}
            onClick={gravarContrato}
          >
            <FileText size={16} /> {salvandoContrato ? 'Gravando...' : 'Gerar & Gravar Contrato'}
          </button>
          <button className="btn" onClick={() => window.print()}>
            <Printer size={16} />Imprimir / Salvar PDF
          </button>
        </div>
      </header>

      {/* PAINEL DE CONTROLE DE EMISSÃO E MODELOS (SEM SOBREPOSIÇÃO) */}
      <div className="card no-print" style={{ padding: 18, marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div className="field" style={{ minWidth: 320, flex: 1, margin: 0 }}>
            <label style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: 6, display: 'block' }}>
              Selecionar Negociação Vinculada
            </label>
            <select className="select" value={neg?.id || ''} onChange={(e) => setNegId(e.target.value)}>
              {(Array.isArray(negociacoes) ? negociacoes : []).map((n) => (
                <option key={n.id} value={n.id}>
                  #{n.id} — {n.cliente_nome || 'Cliente'} · {n.veic_marca || ''} {n.veic_modelo || ''} ({brl(Number(n.valor_veiculo || 0) - Number(n.desconto || 0))}) [{n.tipo?.toUpperCase()}]
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {contratoGravado ? (
              <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={14} /> Contrato Emitido e Gravado (#{contratoGravado.id})
              </span>
            ) : (
              <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Pendente de Gravação
              </span>
            )}
          </div>
        </div>

        <div>
          <label style={{ fontWeight: 700, fontSize: '.88rem', marginBottom: 8, display: 'block' }}>
            Modelo do Contrato Oficial (Clique para alternar minuta)
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            {MODELOS_CONTRATO.map((m) => {
              const ativo = modelo === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  className="card"
                  style={{
                    textAlign: 'left',
                    padding: '10px 14px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: ativo ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: ativo ? 'hsla(217, 91%, 60%, .08)' : '#ffffff',
                    transition: 'all .15s ease'
                  }}
                  onClick={() => setModelo(m.id)}
                >
                  <strong style={{ fontSize: '.84rem', display: 'block', color: ativo ? 'var(--primary)' : 'var(--text)' }}>
                    {m.label}
                  </strong>
                  <span style={{ fontSize: '.72rem', color: 'var(--muted)', display: 'block', marginTop: 3 }}>
                    {m.sub}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {!neg ? (
        <div className="card empty">Nenhuma negociação cadastrada para gerar documentos.</div>
      ) : (
        <div className="doc-preview" style={{ background: '#ffffff', color: '#111827', padding: '36px 42px', fontSize: '.92rem', lineHeight: 1.6 }}>
          {/* CABEÇALHO DO DOCUMENTO COM IDENTIFICAÇÃO DA EMPRESA */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111827', paddingBottom: 14, marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '-.02em' }}>
                {loja?.nome_fantasia || 'DG Automóveis'}
              </h2>
              <div style={{ fontSize: '.82rem', color: '#4b5563', marginTop: 4 }}>
                <strong>{loja?.razao_social || 'DG Automóveis Comércio de Veículos Ltda'}</strong> · CNPJ: {loja?.cnpj || '35.236.994/0001-24'}<br />
                {loja?.endereco || 'Rua Dom Pedro II, 461 - Canoas'} — {cidEmp}/{sigEmp} · Telefone: {loja?.telefone || '(47) 98916-9598'}
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: '.84rem' }}>
              <strong>CONTRATO Nº #{neg.id}</strong><br />
              Data: {dataBr(neg.data_fechamento || neg.data_negociacao)}<br />
              <span className="badge badge-disponivel" style={{ textTransform: 'uppercase', fontSize: '.72rem', marginTop: 4 }}>
                Operação: {neg.tipo || 'Venda'}
              </span>
            </div>
          </div>

          {/* DADOS DAS PARTES */}
          <div className="doc-box" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: 12, borderRadius: 6, marginBottom: 16 }}>
            {neg.tipo === 'compra' ? (
              <>
                <strong>VENDEDOR(A) / PROPRIETÁRIO(A):</strong> <strong>{nomCli}</strong>, inscrito(a) no CPF/CNPJ sob nº <strong>{neg.cliente_cpf_cnpj || '___.___.___-__'}</strong>, telefone {neg.cliente_telefone || '__________'}, residente e domiciliado(a) em {neg.cliente_endereco || '________________'}, {neg.cliente_cidade || cidEmp}/{neg.cliente_uf || sigEmp}.<br />
                <strong>COMPRADORA / REVENDEDORA:</strong> {loja?.razao_social || 'DG Automóveis Comércio de Veículos Ltda'}, CNPJ nº {loja?.cnpj || '35.236.994/0001-24'}, com sede em {loja?.endereco || 'Rua Dom Pedro II, 461 - Canoas'}, {cidEmp}/{sigEmp}.
              </>
            ) : neg.tipo === 'consignacao' ? (
              <>
                <strong>CONSIGNANTE / PROPRIETÁRIO(A):</strong> <strong>{nomCli}</strong>, inscrito(a) no CPF/CNPJ sob nº <strong>{neg.cliente_cpf_cnpj || '___.___.___-__'}</strong>, telefone {neg.cliente_telefone || '__________'}, residente e domiciliado(a) em {neg.cliente_endereco || '________________'}, {neg.cliente_cidade || cidEmp}/{neg.cliente_uf || sigEmp}.<br />
                <strong>CONSIGNATÁRIA / INTERMEDIADORA:</strong> {loja?.razao_social || 'DG Automóveis Comércio de Veículos Ltda'}, CNPJ nº {loja?.cnpj || '35.236.994/0001-24'}, com sede em {loja?.endereco || 'Rua Dom Pedro II, 461 - Canoas'}, {cidEmp}/{sigEmp}.
              </>
            ) : (
              <>
                <strong>VENDEDOR(A) / LOJA:</strong> {loja?.razao_social || 'DG Automóveis Comércio de Veículos Ltda'}, CNPJ nº {loja?.cnpj || '35.236.994/0001-24'}, com sede em {loja?.endereco || 'Rua Dom Pedro II, 461 - Canoas'}, {cidEmp}/{sigEmp}.<br />
                <strong>COMPRADOR(A) / CLIENTE:</strong> <strong>{nomCli}</strong>, inscrito(a) no CPF/CNPJ sob nº <strong>{neg.cliente_cpf_cnpj || '___.___.___-__'}</strong>, telefone {neg.cliente_telefone || '__________'}, residente e domiciliado(a) em {neg.cliente_endereco || '________________'}, {neg.cliente_cidade || cidEmp}/{neg.cliente_uf || sigEmp}.
              </>
            )}
          </div>

          {/* DADOS DO OBJETO (VEÍCULO PRINCIPAL) */}
          <div className="doc-box" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: 12, borderRadius: 6, marginBottom: 16 }}>
            <strong>VEÍCULO OBJETO DO CONTRATO:</strong> Marca/Modelo: <strong>{veicObj.marca} {veicObj.modelo}</strong> · Ano: <strong>{veicObj.ano || '—'}</strong> · Cor: <strong>{veicObj.cor || 'Não informada'}</strong><br />
            Placa: <strong>{veicObj.placa || '—'}</strong> · Renavam: <strong>{veicObj.renavam || '—'}</strong> · Chassi: <strong>{veicObj.chassi || '—'}</strong> · Hodômetro Marcando: <strong>{qvnAut}</strong>.
          </div>

          {/* PREÇO E FORMA DE PAGAMENTO */}
          <div className="doc-box" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: 12, borderRadius: 6, marginBottom: 18 }}>
            <strong>VALOR E CONDIÇÕES DE PAGAMENTO:</strong><br />
            O valor total e certo ajustado é de <strong>{brl(valorLiquido)}</strong>{neg.desconto > 0 ? ` (com desconto promocional de ${brl(neg.desconto)})` : ''}, liquidado da seguinte forma:
            <ul style={{ paddingLeft: 22, marginTop: 6, marginBottom: 6 }}>
              {pagamentosLista.length > 0 ? (
                pagamentosLista.map((p, idx) => (
                  <li key={idx}>
                    <strong>{p.forma}</strong> ({p.financeira || 'Direto / À vista'}): <strong>{brl(p.valor)}</strong>
                  </li>
                ))
              ) : (
                <li><strong>{neg.tipo === 'compra' ? 'Pagamento Direto / À vista' : 'Pix / TED'}:</strong> {brl(valorLiquido)}</li>
              )}
            </ul>
            {neg.tipo === 'troca' && neg.troca_modelo && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #94a3b8' }}>
                <strong>VEÍCULO RECEBIDO NA TROCA:</strong> {neg.troca_marca} {neg.troca_modelo}, Ano {neg.troca_ano}, Placa {neg.troca_placa || '—'}, Hodômetro: <strong>{qcmvTr}</strong>, avaliado em <strong>{brl(neg.troca_valor)}</strong>, entregue livre de quaisquer multas ou gravames anteriores a esta data.
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* MODELO 1: VENDA PADRÃO COM LGPD (10 CLÁUSULAS) */}
          {/* ========================================================================= */}
          {modelo === 'venda_padrao' && (
            <div>
              <h3 style={{ textAlign: 'center', textTransform: 'uppercase', marginBottom: 18, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                CONTRATO PARTICULAR DE COMPRA E VENDA DE VEÍCULO AUTOMOTOR (PADRÃO COM LGPD)
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'justify' }}>
                <p>
                  <strong>1ª</strong> O VENDEDOR se compromete a entregar o veículo livre e desembaraçado de quaisquer ônus que pese sobre o mesmo, declarando não haver alienação fiduciária, penhor, arresto, sequestro ou qualquer gravame sobre o bem, salvo se expressamente informado e quitado antes da entrega da documentação de transferência.
                </p>
                <p>
                  <strong>2ª</strong> Fica o COMPRADOR obrigado a efetuar a transferência do veículo supramencionado, no prazo de 30 (trinta) dias, a contar desta data, para seu nome ou de outrem. O VENDEDOR, por sua vez, se compromete a protocolar a Comunicação de Venda junto ao órgão de trânsito competente no prazo de até 30 (trinta) dias corridos, contados desta data, entregando ao COMPRADOR o respectivo protocolo/comprovante. Cumprida essa obrigação pelo VENDEDOR, este se exime de qualquer responsabilidade solidária por multas, tributos ou infrações incidentes sobre o veículo a partir da data da comunicação, nos termos do artigo 134 do Código de Trânsito Brasileiro.
                </p>
                <p>
                  <strong>3ª</strong> O COMPRADOR assume, a partir da retirada do veículo do pátio da loja, integral responsabilidade civil e criminal por quaisquer danos materiais e/ou pessoais causados a terceiros, bem como o pagamento integral de todos os impostos, multas, taxas e licenciamentos incidentes sobre o veículo a partir dessa mesma data.
                </p>
                <p>
                  <strong>4ª</strong> O COMPRADOR declara ter vistoriado o veículo acima descrito, tendo submetido o bem, previamente à aquisição, à avaliação de mecânico e/ou oficina de sua confiança, estando ciente das condições mecânicas, elétricas e estruturais do veículo. Em razão do estado do bem, avaliado pelo próprio COMPRADOR e/ou por profissional de sua escolha, o veículo foi comercializado com desconto em relação à tabela de mercado, ficando ajustado entre as partes que o VENDEDOR NÃO CONCEDE GARANTIA CONTRATUAL sobre o veículo, tendo o COMPRADOR plena ciência e aceitando o estado de conservação e funcionamento do bem no ato da compra. Esta cláusula não afasta a garantia legal mínima prevista no Código de Defesa do Consumidor para eventuais defeitos ocultos que não pudessem ser razoavelmente detectados na avaliação mecânica realizada.
                </p>
                <p>
                  <strong>5ª</strong> O COMPRADOR declara, sob as penas da lei, estar ciente da obrigação de adotar as providências necessárias à expedição do Certificado de Registro do Veículo (CRV) em seu nome, no prazo de 30 (trinta) dias, contados do reconhecimento de firma no CRV pelo VENDEDOR, nos termos do §1º do artigo 123 do Código de Trânsito Brasileiro, não podendo circular com o veículo sem a documentação formalmente transferida.
                </p>
                <p>
                  <strong>6ª</strong> O COMPRADOR declara que, previamente à aquisição do(s) veículo(s) suprarreferido(s), recebeu clara e satisfatoriamente as informações sobre o valor dos tributos incidentes na comercialização do(s) veículo(s) e da situação de regularidade do(s) mesmo(s), bem como sobre autuações, taxas, débitos de impostos (inclusive a periodicidade de incidência) ou quaisquer fatos conhecidos que limitem ou impeçam a circulação do veículo. Igualmente lhe foi esclarecido sobre registros de furto ou de gravame (alienação fiduciária), bem como o alerta de que as informações fornecidas sobre a regularidade poderão ser obtidas e confirmadas nos sítios eletrônicos das autoridades policiais, de trânsito e fazendárias das unidades da Federação onde o veículo está registrado. A presente declaração tem como finalidade o cumprimento do quanto disposto na Lei nº 13.111/2015, cujo texto o COMPRADOR declara ter ciência.
                </p>
                <p>
                  <strong>7ª</strong> Os dados pessoais do COMPRADOR coletados neste ato (nome, CPF, endereço, dados de contato e informações financeiras) serão tratados pelo VENDEDOR exclusivamente para fins de execução deste contrato, cumprimento de obrigações legais e comunicação relacionada à venda, nos termos da Lei nº 13.709/2018 (LGPD).
                </p>
                <div style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: 6, margin: '4px 0' }}>
                  <p style={{ margin: 0 }}>
                    <strong>8ª</strong> O COMPRADOR autoriza o VENDEDOR a captar e utilizar, a título gratuito, fotos e/ou vídeos do momento da entrega do veículo (imagem do COMPRADOR e do bem) para fins de divulgação em redes sociais, site e materiais de marketing da empresa, nos termos do art. 7º, I, da Lei nº 13.709/2018 (LGPD). Esta autorização é facultativa, não condiciona a venda, e pode ser revogada a qualquer tempo mediante solicitação por escrito ao VENDEDOR, sem qualquer ônus para o COMPRADOR.
                  </p>
                  <div style={{ marginTop: 8, display: 'flex', gap: 20 }}>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="radio" name="lgpd_img" checked={autorizaImagem} onChange={() => setAutorizaImagem(true)} />
                      ( <strong>X</strong> ) Autorizo a divulgação da minha imagem conforme acima descrito.
                    </label>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <input type="radio" name="lgpd_img" checked={!autorizaImagem} onChange={() => setAutorizaImagem(false)} />
                      ( &nbsp; ) Não autorizo a divulgação da minha imagem.
                    </label>
                  </div>
                </div>
                <p>
                  <strong>9ª</strong> As partes reconhecem como válida e eficaz a assinatura eletrônica aposta neste instrumento, para todos os fins de direito, nos termos da Medida Provisória nº 2.200-2/2001 e da Lei nº 14.063/2020.
                </p>
                <p>
                  <strong>10ª</strong> Para dirimir as pendências do presente contrato, fica eleito o foro de <strong>{cidEmp}/{sigEmp}</strong>, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODELO 2: VENDA COM DESCONTO / ISENÇÃO E HODÔMETRO (11 CLÁUSULAS) */}
          {/* ========================================================================= */}
          {modelo === 'venda_desconto' && (
            <div>
              <h3 style={{ textAlign: 'center', textTransform: 'uppercase', marginBottom: 18, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                CONTRATO PARTICULAR DE COMPRA E VENDA — DESCONTO CONCEDIDO / VÍCIO OCULTO E HODÔMETRO
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'justify' }}>
                <p>
                  <strong>1ª</strong> O VENDEDOR se compromete a entregar o veículo livre e desembaraçado de quaisquer ônus que pese sobre o mesmo.
                </p>
                <p>
                  <strong>2ª</strong> Fica o COMPRADOR obrigado a efetuar a transferência do veículo supramencionado, no prazo de 30 (trinta) dias, a contar desta data, para seu nome ou de outrem, caso não o faça, o VENDEDOR, se exime de pagar quaisquer multas, sobre o veículo acima descriminado.
                </p>
                <p>
                  <strong>3ª</strong> O COMPRADOR se responsabiliza civil e criminalmente por danos causados a terceiros, a partir do momento que se realizou fechamento de negócio.
                </p>
                <div style={{ background: '#fef2f2', borderLeft: '4px solid #ef4444', padding: '12px 14px', borderRadius: 4 }}>
                  <p style={{ margin: 0 }}>
                    <strong>4ª</strong> O COMPRADOR declara ter vistoriado o veículo acima descrito junto ao seu mecânico de confiança e adquirido o mesmo, no estado em que se encontra nada tendo a reclamar, a que título for respeitando e cumprindo fielmente os termos da presente, haja vista que o cliente está ciente e bem orientado que o veículo <strong>FOI CEDIDO DESCONTO</strong>. Sendo assim o COMPRADOR fica ciente que qualquer concertos que vier aparecer inclusive vicios ocultos não terá reembolso.
                  </p>
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #fca5a5' }}>
                    Eu <strong>{nomCli}</strong> estou ciente das condiçoes de venda descrita no paragrafo 4ª e concordo plenamente, isentando a loja por cobrança futura.<br />
                    <span style={{ display: 'block', marginTop: 14 }}>Assinatura do COMPRADOR: __________________________________________________</span>
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 6 }}>
                  <p style={{ margin: 0 }}>
                    <strong>5ª</strong> O COMPRADOR declara que o hodômetro do veículo que está comprando está marcando exatamente: <strong>{qvnAut}</strong> e que o veículo que está dando na troca está marcando: <strong>{qcmvTr}</strong>.
                  </p>
                  <p style={{ margin: '6px 0 0 0' }}>
                    Eu <strong>{nomCli}</strong> Afirmo que veirifiquei os hodômetros e concordo com as informações acima descrita.
                  </p>
                </div>
                <p>
                  <strong>6ª</strong> Com o veículo acima descrito, declaro, sob pena da lei, estar ciente da obrigação de adotar as providências necessárias à efetivação da expedição do Certificado de Registro do Veículo para meu nome, no prazo de 30 (trinta) dias, contados do reconhecimento de firma CRV pela Vendedora, de acordo com o 1º do artigo do Código de Trânsito Brasileiro, não podendo circular com o veículo sem estar com documentação formalmente transferida.
                </p>
                <p>
                  <strong>7ª</strong> Assumo expressamente a partir desta data, a responsabilidade civil e criminal por quaisquer danos materiais e/ou pessoais causados a terceiros, desde a retirada do veículo do pátio da loja. Assumo também o pagamento integral de todos os impostos, multas, taxas e licenciamentos, ocorridos a partir desta data.
                </p>
                <p>
                  <strong>8ª</strong> O COMPRADOR, declara que previamente a aquisição do(s) veículo(s) suprarreferido(s), recebeu clara e satisfatoriamente as informações sobre o valor dos tributos incidentes na comercialização do(s) veículo(s) e da situação de regularidade do(s) mesmo(s), bem como sobre autuações, taxas, débitos de impostos (inclusive a periodicidade de incidência) ou quaisquer fatos conhecidos que limitem ou impeçam a circulação do veículo. Igualmente me foi esclarecido sobre registros de furto ou de registro de gravame (alienação fiduciária), bem como que recebeu o alerta que as informações fornecidas sobre a regularidade poderão ser obtidas e confirmadas nos sítios eletrônicos das autoridades policiais, de trânsito e fazendárias das unidades da Federação onde o veículo está registrado. A presente declaração tem como finalidade o cumprimento do quanto disposto na Lei 13.111/15 cujo texto teve ciência.
                </p>
                <p>
                  <strong>9ª</strong> Para veículos com correia dentada, o cliente está ciente que deve trocá-la senão perderá garantia do motor, exceto para veículos zero quilômetro.
                </p>
                <p>
                  <strong>10ª</strong> Caso, por qualquer motivo, haja desistência de quaisquer das partes do negócio ora celebrado, a parte que desistiu arcará com a multa de <strong>20% (vinte por cento)</strong> do Valor total da negociação a ser paga à outra parte.
                </p>
                <p>
                  <strong>11ª</strong> Para dirimir as pendências do presente contrato, fica eleito, como renúncia de qualquer outro, seja qual for por mais privilegiado que seja, o foro da cidade de <strong>{cidEmp}/{sigEmp}</strong>.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODELO 3: VENDA COMPLETA CDC (18 CLÁUSULAS) */}
          {/* ========================================================================= */}
          {modelo === 'venda_completa' && (
            <div>
              <h3 style={{ textAlign: 'center', textTransform: 'uppercase', marginBottom: 18, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                CONTRATO DE COMPRA E VENDA INTEGRAL — GARANTIA CDC, VISTORIA E PENALIDADES
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, textAlign: 'justify' }}>
                <p><strong>Cláusula 1ª:</strong> O VENDEDOR se compromete a entregar o veículo livre e desembaraçado de quaisquer ônus que pesem sobre o mesmo, declarando não haver alienação fiduciária, penhor, arresto, sequestro ou qualquer gravame sobre o bem.</p>
                <p><strong>Cláusula 2ª:</strong> Fica o COMPRADOR obrigado a efetuar a transferência de propriedade no prazo improrrogável de 30 (trinta) dias corridos, contados desta data, nos termos do art. 123, §1º do CTB.</p>
                <p><strong>Cláusula 3ª:</strong> O VENDEDOR protocolará a Comunicação de Venda junto ao órgão de trânsito em até 30 dias corridos, isentando-se de qualquer responsabilidade solidária por infrações a contar da data de comunicação (Art. 134 CTB).</p>
                <p><strong>Cláusula 4ª:</strong> O COMPRADOR assume, a partir da retirada do veículo do pátio, integral responsabilidade civil, administrativa e criminal por danos a terceiros, multas de trânsito e tributos.</p>
                <p><strong>Cláusula 5ª:</strong> O COMPRADOR declara ter vistoriado o veículo previamente com seu mecânico de confiança, aceitando as condições mecânicas, elétricas e de conservação.</p>
                <p><strong>Cláusula 6ª:</strong> O VENDEDOR concede a garantia legal prevista no Código de Defesa do Consumidor de 90 (noventa) dias ou 5.000 km (o que ocorrer primeiro) exclusivamente para motor e câmbio em suas partes internas lubrificadas, excluindo peças de desgaste natural (suspensão, pneus, freios, correias, fluidos, lâmpadas, bateria e acabamentos).</p>
                <p><strong>Cláusula 7ª:</strong> Para veículos equipados com correia dentada, o COMPRADOR fica expressamente obrigado a efetuar a substituição imediata da correia e tensor, sob pena de perda total da garantia do motor em caso de rompimento.</p>
                <p><strong>Cláusula 8ª:</strong> O hodômetro do veículo vendido registra <strong>{qvnAut}</strong> e o hodômetro do veículo de troca registra <strong>{qcmvTr}</strong>, declarando o COMPRADOR a veracidade e conformidade dos mesmos.</p>
                <p><strong>Cláusula 9ª:</strong> Em caso de desistência imotivada ou rescisão culposa por qualquer das partes, incidirá multa compensatória irredutível de <strong>20% (vinte por cento)</strong> sobre o valor total do negócio.</p>
                <p><strong>Cláusula 10ª:</strong> O COMPRADOR declara ciência expressa sobre a situação tributária e de regularidade do veículo, em estrito cumprimento à Lei Federal nº 13.111/2015.</p>
                <p><strong>Cláusula 11ª:</strong> Havendo veículo dado na troca, o COMPRADOR garante a idoneidade, procedência e quitação de todos os débitos anteriores à entrega à loja.</p>
                <p><strong>Cláusula 12ª:</strong> O negócio opera sob condição resolutiva, dependendo da efetiva liquidação bancária de transferências, financiamentos e títulos emitidos.</p>
                <p><strong>Cláusula 13ª:</strong> Os dados das partes são tratados em estrita observância à Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD).</p>
                <p><strong>Cláusula 14ª:</strong> O COMPRADOR autoriza facultativamente a captação e veiculação de fotos/vídeos da entrega em redes sociais e canais oficiais da loja.</p>
                <p><strong>Cláusula 15ª:</strong> Reconhecem as partes a validade legal da assinatura eletrônica conforme MP nº 2.200-2/2001 e Lei nº 14.063/2020.</p>
                <p><strong>Cláusula 16ª:</strong> Eventual tolerância das partes quanto a prazos não representará novação contratual.</p>
                <p><strong>Cláusula 17ª:</strong> A invalidade de qualquer cláusula não prejudica a eficácia das demais disposições deste instrumento.</p>
                <p><strong>Cláusula 18ª:</strong> As partes elegem a Comarca de <strong>{cidEmp}/{sigEmp}</strong> como único foro competente para dirimir dúvidas decorrentes deste contrato.</p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODELO 4: COMPRA DE VEÍCULO PARA O ESTOQUE DA LOJA (9 CLÁUSULAS) */}
          {/* ========================================================================= */}
          {modelo === 'compra_estoque' && (
            <div>
              <h3 style={{ textAlign: 'center', textTransform: 'uppercase', marginBottom: 18, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                CONTRATO DE COMPRA E AQUISIÇÃO DE VEÍCULO PARA O ESTOQUE DA LOJA
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'justify' }}>
                <p>
                  <strong>1ª</strong> O VENDEDOR (proprietário originário) vende e transfere definitivamente à COMPRADORA (DG Automóveis) a posse e propriedade do veículo acima descrito, livre e desembaraçado de quaisquer ônus judiciais ou extrajudiciais, penhora, alienação fiduciária, arrendamento mercantil ou reserva de domínio.
                </p>
                <p>
                  <strong>2ª</strong> O VENDEDOR declara sob as penas civis e criminais que o hodômetro do veículo marca exatamente <strong>{qvnAut}</strong> e garante a originalidade e procedência do bem, atestando que o veículo não possui histórico de sinistro grave, leilão, furto/roubo recuperado ou adulteração de numeração de chassi/motor.
                </p>
                <p>
                  <strong>3ª</strong> Todos os débitos tributários (IPVA, DPVAT, licenciamento), multas de trânsito e autuações ocorridas com o veículo em data anterior ou no próprio dia da entrega são de integral responsabilidade do VENDEDOR, comprometendo-se a ressarci-los de imediato caso venham a ser cobrados da COMPRADORA.
                </p>
                <p>
                  <strong>4ª</strong> O preço de compra estipulado no montante de <strong>{brl(valorLiquido)}</strong> será pago pela COMPRADORA após a entrega do Certificado de Registro de Veículo (CRV / ATPV-e) assinado com firma reconhecida por autenticidade e laudo de vistoria cautelar ECV aprovado sem restrições estruturais.
                </p>
                <p>
                  <strong>5ª</strong> O VENDEDOR entrega neste ato o manual do proprietário, chave reserva, ferramentas de bordo (estepe, macaco, chave de roda) e todos os acessórios pertencentes ao veículo.
                </p>
                <p>
                  <strong>6ª</strong> Havendo vício redibitório anterior à venda, histórico de leilão omitido, defeito oculto de motor/câmbio não detectável na inspeção preliminar ou gravame impediente, a COMPRADORA terá o direito irrevogável de rescindir o negócio com a devolução imediata do valor pago, atualizado monetariamente, acrescido de perdas e danos.
                </p>
                <p>
                  <strong>7ª</strong> A parte que der causa à rescisão imotivada deste contrato arcará com a multa compensatória de <strong>20% (vinte por cento)</strong> sobre o valor total do veículo.
                </p>
                <p>
                  <strong>8ª</strong> As partes conferem conformidade ao tratamento dos dados pessoais para fins cadastrais e fiscais nos termos da Lei Geral de Proteção de Dados (LGPD).
                </p>
                <p>
                  <strong>9ª</strong> Para dirimir qualquer litígio resultante deste instrumento, as partes elegem o foro da Comarca de <strong>{cidEmp}/{sigEmp}</strong> com renúncia expressa a qualquer outro.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODELO 5: CONTRATO DE CONSIGNAÇÃO COM SERVIÇOS (8 CLÁUSULAS) */}
          {/* ========================================================================= */}
          {modelo === 'consignacao' && (
            <div>
              <h3 style={{ textAlign: 'center', textTransform: 'uppercase', marginBottom: 18, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                CONTRATO DE CONSIGNAÇÃO DE VEÍCULO, EXPOSIÇÃO EM PÁTIO E PRESTAÇÃO DE SERVIÇOS
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'justify' }}>
                <p>
                  <strong>1ª</strong> O CONSIGNANTE entrega à CONSIGNATÁRIA (DG Automóveis), em caráter de exclusividade, o veículo acima discriminado para guarda, exposição no showroom e intermediação de venda pelo prazo inicial de 60 (sessenta) dias, prorrogável automaticamente por mútuo acordo.
                </p>
                <p>
                  <strong>2ª</strong> Fica acordado o valor líquido de repasse ao CONSIGNANTE de <strong>{brl(valorLiquido)}</strong> no momento da efetivação da venda. A remuneração da CONSIGNATÁRIA consistirá no sobrepreço obtido na negociação ou taxa percentual de comissão previamente acordada.
                </p>

                {/* TABELA DE SERVIÇOS E DESPESAS DE PÁTIO */}
                <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: 14 }}>
                  <strong style={{ display: 'block', marginBottom: 6, fontSize: '.95rem' }}>
                    3ª — TABELA DE SERVIÇOS DE PREPARAÇÃO E DESPESAS DE PÁTIO:
                  </strong>
                  <p style={{ margin: '0 0 8px 0', fontSize: '.86rem', color: '#334155' }}>
                    Para que o veículo possa ser exposto em showroom e veiculado nas mídias digitais, aplicam-se os valores fixados na tabela abaixo, dedutíveis do repasse final ou ressarcíveis pelo CONSIGNANTE em caso de retirada antes do prazo:
                  </p>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.84rem', background: '#ffffff', borderRadius: 6, overflow: 'hidden' }}>
                    <thead>
                      <tr style={{ background: '#0f172a', color: '#ffffff', textAlign: 'left' }}>
                        <th style={{ padding: '8px 10px' }}>Item / Serviço de Pátio</th>
                        <th style={{ padding: '8px 10px' }}>Finalidade</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right' }}>Valor Ajustado</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 10px' }}><strong>Lavagem Especial & Polimento Técnico</strong></td>
                        <td style={{ padding: '8px 10px' }}>Estética de pátio e preparação de pintura</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>R$ 250,00</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 10px' }}><strong>Higienização Completa de Interior & Ozônio</strong></td>
                        <td style={{ padding: '8px 10px' }}>Sanitização de estofamento, teto e dutos</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>R$ 180,00</td>
                      </tr>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '8px 10px' }}><strong>Taxa de Anúncios Web & Destaque (Mensal)</strong></td>
                        <td style={{ padding: '8px 10px' }}>Webmotors, OLX, Chaves na Mão e Site DG</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>R$ 120,00 / mês</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '8px 10px' }}><strong>Serviços Mecânicos / Martelinho de Ouro</strong></td>
                        <td style={{ padding: '8px 10px' }}>Reparos pontuais para viabilizar laudo cautelar</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }}>Conforme orçamento prévio</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p>
                  <strong>4ª</strong> A CONSIGNATÁRIA se responsabiliza pela conservação e guarda do bem no pátio, ficando desde já autorizada a efetuar test-drive com clientes interessados na compra, acompanhado de funcionário da loja.
                </p>
                <p>
                  <strong>5ª</strong> Realizada a venda do veículo, a CONSIGNATÁRIA repassará o valor líquido devido ao CONSIGNANTE no prazo de até 3 (três) dias úteis após a compensação integral dos pagamentos ou liberação bancária do financiamento.
                </p>
                <p>
                  <strong>6ª</strong> O CONSIGNANTE é civil e criminalmente responsável pela veracidade dos dados do veículo, originalidade da quilometragem (hodômetro marcando: <strong>{qvnAut}</strong>) e pela regularidade de todos os tributos e multas incidentes até a entrega na loja.
                </p>
                <p>
                  <strong>7ª</strong> Se o CONSIGNANTE retirar o veículo antes do vencimento do prazo de 60 (sessenta) dias sem autorização expressa, obriga-se ao pagamento imediato do reembolso integral dos serviços executados previstos na Cláusula 3ª.
                </p>
                <p>
                  <strong>8ª</strong> As partes elegem o foro da Comarca de <strong>{cidEmp}/{sigEmp}</strong> com exclusão de qualquer outro.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODELO 6: RECIBO DE PAGAMENTO */}
          {/* ========================================================================= */}
          {modelo === 'recibo' && (
            <div>
              <h3 style={{ textAlign: 'center', textTransform: 'uppercase', marginBottom: 18, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                RECIBO DE PAGAMENTO E QUITAÇÃO DE VEÍCULO — {brl(valorLiquido)}
              </h3>
              <p style={{ marginBottom: 16 }}>
                Recebemos de <strong>{nomCli}</strong>, inscrito(a) no CPF/CNPJ nº <strong>{neg.cliente_cpf_cnpj || '___.___.___-__'}</strong>, a importância total de <strong>{brl(valorLiquido)}</strong> referente à operação comercial sobre o veículo <strong>{veicObj.marca} {veicObj.modelo}</strong>, Ano <strong>{veicObj.ano || '—'}</strong>, Placa <strong>{veicObj.placa || '—'}</strong>, Chassi <strong>{veicObj.chassi || '—'}</strong>.
              </p>
              <div className="doc-box" style={{ background: '#f8fafc', padding: 14, borderRadius: 8, marginBottom: 14 }}>
                <strong>Discriminação dos Pagamentos Compensados:</strong>
                <ul style={{ paddingLeft: 22, marginTop: 6, marginBottom: 0 }}>
                  {pagamentosLista.length > 0 ? (
                    pagamentosLista.map((p, idx) => (
                      <li key={idx}>{p.forma} ({p.financeira || 'À vista'}): <strong>{brl(p.valor)}</strong></li>
                    ))
                  ) : (
                    <li>{neg.tipo === 'compra' ? 'Pagamento Direto / À vista' : 'Pix / TED'}: <strong>{brl(valorLiquido)}</strong></li>
                  )}
                </ul>
              </div>
              <p>
                Pelo que firmamos o presente recibo para que produza seus regulares efeitos, ficando a quitação condicionada à compensação bancária definitiva de eventuais cheques, financiamentos ou transferências eletrônicas.
              </p>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODELO 7: TERMO DE ENTREGA */}
          {/* ========================================================================= */}
          {modelo === 'entrega' && (
            <div>
              <h3 style={{ textAlign: 'center', textTransform: 'uppercase', marginBottom: 18, borderBottom: '1px solid #e2e8f0', paddingBottom: 8 }}>
                TERMO DE ENTREGA DE VEÍCULO E RESPONSABILIDADE CIVIL / CRIMINAL
              </h3>
              <p style={{ textAlign: 'justify', lineHeight: 1.8 }}>
                Declaro para os devidos fins de direito que recebi nesta data, após inspeção e conferência presencial de lataria, pintura, tapeçaria, mecânica e componentes de bordo, o veículo <strong>{veicObj.marca} {veicObj.modelo}</strong>, Placa <strong>{veicObj.placa || '—'}</strong>, Renavam <strong>{veicObj.renavam || '—'}</strong>, Chassi <strong>{veicObj.chassi || '—'}</strong>, com <strong>{qvnAut}</strong> registrados no hodômetro.
              </p>
              <p style={{ textAlign: 'justify', lineHeight: 1.8 }}>
                Assumo expressamente a partir deste ato e horário de saída da loja integral responsabilidade civil, administrativa e criminal pelo uso e circulação do veículo, respondendo por quaisquer sinistros, danos a terceiros, pedágios, autuações e multas de trânsito, comprometendo-me a adotar as providências de transferência do CRV/ATPV-e junto ao órgão de trânsito no prazo de 30 (trinta) dias.
              </p>
            </div>
          )}

          {/* DATA E ASSINATURAS OFICIAIS */}
          <div style={{ marginTop: 28, paddingTop: 16, borderTop: '1px solid #cbd5e1' }}>
            <p style={{ textAlign: 'right', margin: '0 0 24px 0', fontSize: '.9rem' }}>
              <strong>{cidEmp}/{sigEmp}</strong>, {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.
            </p>

            <div className="doc-sign-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30, marginTop: 20 }}>
              <div className="doc-sign-line" style={{ textAlign: 'center', borderTop: '1px solid #111827', paddingTop: 8 }}>
                <strong>{neg.tipo === 'compra' ? nomCli : (loja?.nome_fantasia || 'DG Automóveis')}</strong><br />
                <span style={{ fontSize: '.78rem', color: '#4b5563' }}>
                  {neg.tipo === 'compra'
                    ? `Vendedor(a) / Proprietário(a) (${neg.cliente_cpf_cnpj || 'CPF/CNPJ'})`
                    : `Vendedora / Loja (${loja?.cnpj || '35.236.994/0001-24'})`}
                </span>
              </div>
              <div className="doc-sign-line" style={{ textAlign: 'center', borderTop: '1px solid #111827', paddingTop: 8 }}>
                <strong>{neg.tipo === 'compra' ? (loja?.nome_fantasia || 'DG Automóveis') : nomCli}</strong><br />
                <span style={{ fontSize: '.78rem', color: '#4b5563' }}>
                  {neg.tipo === 'compra'
                    ? `Compradora / Loja (${loja?.cnpj || '35.236.994/0001-24'})`
                    : `Comprador(a) / Consignante (${neg.cliente_cpf_cnpj || 'CPF/CNPJ'})`}
                </span>
              </div>
            </div>

            <div style={{ marginTop: 24, textAlign: 'center', fontSize: '.74rem', color: '#94a3b8' }}>
              Documento gerado eletronicamente por DGAUTOS · Em conformidade com MP nº 2.200-2/2001, Lei nº 14.063/2020 e LGPD (Lei 13.709/2018).
            </div>
          </div>
        </div>
      )}
    </>
  );
}
