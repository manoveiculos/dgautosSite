import React, { useState } from 'react';
import { Calculator, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { brl, calcParcela, waLink } from '../../lib/manos';
import { track } from '../../lib/track';

export default function TradeDiffCalculator({
  targetPrice,
  targetTitle,
}: {
  targetPrice: number;
  targetTitle: string;
}) {
  const [userCarValue, setUserCarValue] = useState<number>(35000);

  const diferenca = Math.max(0, targetPrice - userCarValue);
  const parcelaDiferenca = calcParcela({
    valor: diferenca,
    entrada: 0,
    meses: 48,
  });

  return (
    <div className="p-5 bg-white border border-manos-sand rounded-3xl space-y-4 shadow-sm">
      <div className="flex items-center gap-3 border-b border-manos-sand pb-3">
        <div className="w-10 h-10 rounded-xl bg-manos-warm text-manos-red flex items-center justify-center flex-shrink-0">
          <ArrowRightLeft className="w-5 h-5" />
        </div>
        <div>
          <h4 className="font-serif font-bold text-base text-[#0B1120]">Simular Troca com seu Usado</h4>
          <p className="text-[11px] text-[#475569]">Descubra quanto você paga de diferença</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between">
          <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748B]">
            Valor estimado do seu usado
          </label>
          <span className="text-xs font-bold text-[#0B1120]">{brl(userCarValue)}</span>
        </div>
        <input
          type="range"
          min={10000}
          max={Math.max(150000, targetPrice)}
          step={1000}
          value={userCarValue}
          onChange={(e) => setUserCarValue(Number(e.target.value))}
          className="w-full accent-manos-red cursor-pointer"
        />
      </div>

      <div className="p-4 bg-[#0B1120] text-[#FFFFFF] rounded-2xl space-y-2 text-center">
        <span className="text-[10px] uppercase font-extrabold tracking-widest text-[#CBD5E1]">
          Sua Diferença Final
        </span>
        <div className="text-2xl font-serif font-extrabold text-white">
          {brl(diferenca)}
        </div>
        {diferenca > 0 && (
          <p className="text-xs text-green-400 font-bold">
            Ou financie a diferença em 48x de {brl(parcelaDiferenca)}/mês
          </p>
        )}
      </div>

      <a
        href={waLink(`Olá! Simulei a troca do meu usado (${brl(userCarValue)}) pelo ${targetTitle} (${brl(targetPrice)}). Diferença estimada: ${brl(diferenca)}.`)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('trade_calc_click', { targetTitle, userCarValue, diferenca })}
        className="w-full py-3.5 bg-manos-red text-manos-accent font-extrabold text-xs uppercase rounded-xl flex items-center justify-center gap-2 shadow-md min-h-[44px]"
      >
        Propor Troca com meu Usado
      </a>
    </div>
  );
}
