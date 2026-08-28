/* GENERADO. No editar a mano.
   La plantilla de fila de Replenishment recortada de `js/views/dashboard_v28.js`, para
   medir cuanto cuesta dibujarla sin levantar la plataforma. La usa `medir_tabla_repl.html`. */
export const fila = (i, idx, umbral, estadoBadge, aBajarDe, solicitudDe) => `
        <tr>
          <td class="rq-m">${idx + 1}</td>
          <td class="rq-m">${i.art7}</td>
          <td class="rq-sku">${i.sku}</td>
          <td class="rq-c rq-talla">${i.talla}</td>
          <td class="rq-marca">${i.marcas}</td>
          <td class="rq-gen">${i.genderRims}</td>
          <td class="rq-temp">${i.temporada}</td>
          <td class="rq-c rq-fac">${i.factor !== undefined ? i.factor : umbral}</td>
          <td class="rq-d rq-act" style="color:${i.qAct === 0 ? 'var(--danger)' : i.qAct <= (i.factor !== undefined ? i.factor : umbral) ? 'var(--warning)' : 'var(--text-pale)'};">${i.qAct.toLocaleString('es-PE')}</td>
          <td class="rq-d rq-res" style="color:${i.qRes > 0 ? 'var(--success)' : '#ef444488'};">${i.qRes.toLocaleString('es-PE')}</td>
          <td class="rq-d rq-baj" style="color:${aBajarDe(i) > 0 ? 'var(--text-strong)' : 'rgba(var(--ink-rgb), 0.2)'};"${i.relleno > 0 ? ` title="Incluye ${i.relleno} pares por encima del tope, para no dejar el cuerpo a medio llenar"` : ''}>${aBajarDe(i) > 0 ? aBajarDe(i).toLocaleString('es-PE') : '—'}${i.relleno > 0 ? '<span class="rq-mas"> +' + i.relleno.toLocaleString('es-PE') + '</span>' : ''}</td>
          <td class="rq-d rq-sol" style="color:${solicitudDe(i) > 0 ? 'var(--brand-pale)' : 'rgba(var(--ink-rgb), 0.2)'};">${solicitudDe(i) > 0 ? solicitudDe(i).toLocaleString('es-PE') : '—'}</td>
          <td class="rq-c">${estadoBadge(i.estado)}</td>
        </tr>`;
