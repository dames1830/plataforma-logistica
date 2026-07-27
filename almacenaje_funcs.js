

const renderHourlyProductionReport = (tasksList) => {
        const targetHours = [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6];
        const hourlyData = {};
        
        tasksList.forEach(t => {
            if (t.status !== 'Finalizado') return;
            if (!t.termino) return;
            
            const dateObj = new Date(t.termino);
            const hr = dateObj.getHours();
            if (!targetHours.includes(hr)) return;
            
            const dateKey = t.fecha || '---';
            if (dateKey === '---') return;
            
            if (!hourlyData[dateKey]) {
                hourlyData[dateKey] = {};
                targetHours.forEach(h => hourlyData[dateKey][h] = 0);
            }
            
            hourlyData[dateKey][hr] += getTaskTotalAvance(t);
        });

        const activeDates = Object.keys(hourlyData).filter(dateKey => {
            const total = targetHours.reduce((sum, hr) => sum + hourlyData[dateKey][hr], 0);
            return total > 0;
        });

        activeDates.sort((a, b) => b.localeCompare(a));

        if (!window.__hourlySetPage) window.__hourlySetPage = (p) => { const _sy=window.scrollY; window.__hourlyPage=p; if(window.renderAlmacenajeTareas) window.renderAlmacenajeTareas(container); requestAnimationFrame(()=>window.scrollTo({top:_sy,behavior:'instant'})); };
        const _hourlyPage = window.__hourlyPage || 0;
        const _hourlyTotalPages = Math.ceil(activeDates.length / 25);
        window.__hourlyTotalPages = _hourlyTotalPages;
        window.__hourlyTotalRows = activeDates.length;
        const activeHourlyPage = _hourlyPage >= _hourlyTotalPages ? 0 : _hourlyPage;
        window.__hourlyPage = activeHourlyPage;
        const pagedActiveDates = activeDates.slice(activeHourlyPage * 25, (activeHourlyPage + 1) * 25);

        const formatLogicalDate = (dateStr) => {
            if (!dateStr || dateStr === '---') return '---';
            const parts = dateStr.split('-');
            if (parts.length !== 3) return dateStr;
            const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            const day = parseInt(parts[2], 10);
            const monthIdx = parseInt(parts[1], 10) - 1;
            return `${day}-${months[monthIdx] || parts[1]}`;
        };

        return `
        <!-- REPORTE DE PRODUCCIÓN POR HORA (ANCHO COMPLETO) -->
        <div style="background:#000000; border:2px solid #00E5FF; border-radius:12px; padding:0.8rem 1.2rem; box-shadow: 0 0 25px rgba(0,229,255,0.2); font-family:var(--font-sans, 'Inter', sans-serif); color:#fff; display:flex; flex-direction:column; gap:0.6rem; margin-top:1.5rem; width:100%;">
            <div style="border-left: 4px solid #00E5FF; padding-left: 10px; display:flex; flex-direction:column; gap:2px;">
                <h3 style="color:#00E5FF; font-weight:900; margin:0; font-size:1rem; letter-spacing:1.5px; text-transform:uppercase; font-family:'Outfit', sans-serif;">
                    REPORTE DE PRODUCCIÓN POR HORA
                </h3>
                <div style="font-size:0.68rem; color:rgba(0, 229, 255, 0.6); font-weight:700; letter-spacing:0.5px;">
                    CANTIDAD DE UNIDADES PROCESADAS POR RANGO HORARIO (TAREA FINALIZADA)
                </div>
            </div>
            <div style="overflow-x:auto; margin-top:0.4rem;">
                <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                    <thead>
                        <tr style="color:#00E5FF; text-transform:uppercase; font-size:0.72rem; font-weight:800; letter-spacing:0.05em; border-bottom:2px solid #00E5FF;">
                            <th style="padding:6px 8px; text-align:left; width:80px;">FECHA</th>
                            ${targetHours.map(hr => `<th style="padding:6px 4px; text-align:center;">${hr.toString().padStart(2, '0')}:00</th>`).join('')}
                            <th style="padding:6px 8px; text-align:center; width:90px;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pagedActiveDates.length === 0 ? `<tr><td colspan="${targetHours.length + 2}" style="padding:3rem; text-align:center; color:rgba(0, 229, 255, 0.4); font-weight:700;">No hay producción por hora registrada.</td></tr>` : pagedActiveDates.map(dateKey => {
                            const rowData = hourlyData[dateKey];
                            const rowTotal = targetHours.reduce((sum, hr) => sum + rowData[hr], 0);
                            return `
                                <tr style="border-bottom: 1px solid rgba(0, 229, 255, 0.08); background:#000000;">
                                    <td style="padding:6px 8px; color:#ffffff; font-weight:700;">${formatLogicalDate(dateKey)}</td>
                                    ${targetHours.map(hr => {
                                        const qty = rowData[hr];
                                        return `<td style="padding:6px 4px; text-align:center; color:${qty > 0 ? '#ffffff' : 'rgba(255,255,255,0.45)'}; font-weight:${qty > 0 ? '700' : '400'};">${qty > 0 ? qty.toLocaleString() : '0'}</td>`;
                                    }).join('')}
                                    <td style="padding:6px 8px; text-align:center; color:#00E5FF; font-weight:900; background:rgba(0, 229, 255, 0.05);">${rowTotal.toLocaleString()}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            ${(() => {
                const tp = window.__hourlyTotalPages || 1;
                const cp = window.__hourlyPage || 0;
                if (tp <= 1) return '';
                const btnStyle = (active, dis) => `padding:4px 9px; border-radius:6px; border:1px solid #00E5FF; background:${active?'rgba(0,229,255,0.25)':'rgba(255,255,255,0.03)'}; color:${dis?'rgba(255,255,255,0.2)':active?'#fff':'#00E5FF'}; cursor:${dis?'default':'pointer'}; font-size:0.7rem; font-weight:${active?900:500};`;
                const pages = Array.from({length: tp}, (_, i) => i);
                return `<div style="display:flex; align-items:center; justify-content:center; gap:5px; padding-top:0.6rem; border-top:1px solid rgba(0,229,255,0.1); margin-top:0.4rem;">
                    <button onclick="window.__hourlySetPage(${Math.max(0,cp-1)})" ${cp===0?'disabled':''} style="${btnStyle(false,cp===0)}">← Ant</button>
                    ${pages.map(p=>`<button onclick="window.__hourlySetPage(${p})" style="${btnStyle(p===cp,false)}">${p+1}</button>`).join('')}
                    <button onclick="window.__hourlySetPage(${Math.min(tp-1,cp+1)})" ${cp===tp-1?'disabled':''} style="${btnStyle(false,cp===tp-1)}">Sig →</button>
                    <span style="font-size:0.7rem; color:rgba(0,229,255,0.4); margin-left:6px;">Pág ${cp+1} / ${tp} (${window.__hourlyTotalRows || 0} registros)</span>
                </div>`;
            })()}
        </div>
        `;
    }

const renderWeeklyStorageReport = (tasksList) => {
        const weeklyBrandData = {};
        const weeklyBrandGenderData = {};
        const allBrandsSet = new Set();
        const allGendersPerWeek = {};

        // Build a dynamic map of sku7 to live Column C (G. Gender) from the current maestro dataStore.articulos
        const liveGenderMap = new Map();
        const activeMaestro = dataStore.articulos || [];
        activeMaestro.forEach(row => {
            const raw = Array.isArray(row) ? row : Object.values(row);
            const sku7 = String(raw[1] || '').trim().substring(0, 7);
            if (sku7 && !liveGenderMap.has(sku7)) {
                // Column C (index 2) is G. Gender
                liveGenderMap.set(sku7, String(raw[2] || '').trim().toUpperCase());
            }
        });

        const getWeekStr = (dateStr) => {
            if (!dateStr || dateStr === '---') return '---';
            const parts = dateStr.split('-');
            if (parts.length !== 3) return '---';
            const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
            const weekNo = getWeekNumber(dateObj);
            return `Semana ${weekNo} (${parts[0]})`;
        };

        tasksList.forEach(t => {
            if (t.status !== 'Finalizado') return;
            const weekStr = getWeekStr(t.fecha);
            if (weekStr === '---') return;
            
            let brand = String(t.marca || 'S/M').trim();
            if (brand === 'Bubblegummers Licenses') brand = 'BG. Licenses';
            if (brand === 'Bubblegummers') brand = 'BG';
            
            allBrandsSet.add(brand);
            
            if (!weeklyBrandData[weekStr]) {
                weeklyBrandData[weekStr] = {};
            }
            if (!weeklyBrandData[weekStr][brand]) {
                weeklyBrandData[weekStr][brand] = 0;
            }
            weeklyBrandData[weekStr][brand] += getTaskTotalAvance(t);

            // Group by gender for drilldown
            if (!weeklyBrandGenderData[weekStr]) {
                weeklyBrandGenderData[weekStr] = {};
                allGendersPerWeek[weekStr] = new Set();
            }
            (t.items || []).forEach(art => {
                const liveGender = liveGenderMap.get(art.sku7);
                const gender = (liveGender && liveGender !== '') ? liveGender : (String(art.gender || 'S/G').trim().toUpperCase() || 'S/G');
                allGendersPerWeek[weekStr].add(gender);
                if (!weeklyBrandGenderData[weekStr][gender]) {
                    weeklyBrandGenderData[weekStr][gender] = {};
                }
                if (!weeklyBrandGenderData[weekStr][gender][brand]) {
                    weeklyBrandGenderData[weekStr][gender][brand] = 0;
                }
                let artQty = 0;
                (art.items || []).forEach(i => {
                    const ubi = String(i.ubi || '').toUpperCase();
                    if (ubi.startsWith('CDBUFFER') && !ubi.startsWith('CDBUFFER-C')) {
                        artQty += (i.avance !== undefined && i.avance !== null) ? parseFloat(i.avance) : (parseFloat(i.qty) || 0);
                    }
                });
                if (artQty === 0) {
                    const hasAvanceInfo = (t.items || []).some(a => (a.items || []).some(item => item.avance !== undefined && item.avance !== null));
                    if (!hasAvanceInfo) {
                        artQty = parseFloat(art.bufferQty) || 0;
                    }
                }
                weeklyBrandGenderData[weekStr][gender][brand] += artQty;
            });
        });

        const predefinedBrands = ['Bata', 'North Star', 'Adidas', 'Puma'];
        const otherBrands = Array.from(allBrandsSet)
            .filter(b => !predefinedBrands.includes(b))
            .sort((a, b) => a.localeCompare(b));
        
        const sortedBrands = [
            ...predefinedBrands.filter(b => allBrandsSet.has(b)),
            ...otherBrands
        ];

        const sortedWeeks = Object.keys(weeklyBrandData).sort((a, b) => {
            const getVal = (s) => {
                const m = s.match(/Semana (\d+) \((\d+)\)/);
                if (!m) return 0;
                return parseInt(m[2]) * 100 + parseInt(m[1]);
            };
            return getVal(a) - getVal(b);
        });

        if (!window.__weeklySetPage) window.__weeklySetPage = (p) => { const _sy=window.scrollY; window.__weeklyPage=p; if(window.renderAlmacenajeTareas) window.renderAlmacenajeTareas(container); requestAnimationFrame(()=>window.scrollTo({top:_sy,behavior:'instant'})); };
        const _weeklyPage = window.__weeklyPage || 0;
        const _weeklyTotalPages = Math.ceil(sortedWeeks.length / 25);
        window.__weeklyTotalPages = _weeklyTotalPages;
        window.__weeklyTotalRows = sortedWeeks.length;
        const activeWeeklyPage = _weeklyPage >= _weeklyTotalPages ? 0 : _weeklyPage;
        window.__weeklyPage = activeWeeklyPage;
        const pagedSortedWeeks = sortedWeeks.slice(activeWeeklyPage * 25, (activeWeeklyPage + 1) * 25);

        const colTotals = {};
        sortedBrands.forEach(b => colTotals[b] = 0);
        let grandTotal = 0;

        sortedWeeks.forEach(w => {
            sortedBrands.forEach(b => {
                const qty = weeklyBrandData[w][b] || 0;
                colTotals[b] += qty;
                grandTotal += qty;
            });
        });

        return `
        <!-- REPORTE DE ALMACENADO POR SEMANA (ANCHO COMPLETO) -->
        <div style="background:#000000; border:2px solid #8b5cf6; border-radius:12px; padding:0.8rem 1.2rem; box-shadow: 0 0 25px rgba(139,92,246,0.2); font-family:var(--font-sans, 'Inter', sans-serif); color:#fff; display:flex; flex-direction:column; gap:0.6rem; margin-top:1.5rem; width:100%;">
            <div style="border-left: 4px solid #8b5cf6; padding-left: 10px; display:flex; flex-direction:column; gap:2px;">
                <h3 style="color:#a78bfa; font-weight:900; margin:0; font-size:1rem; letter-spacing:1.5px; text-transform:uppercase; font-family:'Outfit', sans-serif;">
                    REPORTE DE ALMACENADO POR SEMANA Y MARCA
                </h3>
                <div style="font-size:0.68rem; color:rgba(167, 139, 250, 0.6); font-weight:700; letter-spacing:0.5px;">
                    DISTRIBUCIÓN DE CANTIDADES ALMACENADAS POR SEMANA E ISO Y MARCAS PRINCIPALES (HAGA CLIC EN UNA SEMANA PARA EXPANDIR POR GÉNERO)
                </div>
            </div>
            <div style="overflow-x:auto; margin-top:0.4rem;">
                <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                    <thead>
                        <tr style="color:#a78bfa; text-transform:uppercase; font-size:0.72rem; font-weight:800; letter-spacing:0.05em; border-bottom:2px solid #8b5cf6;">
                            <th style="padding:6px 8px; text-align:left; width:120px;">SEMANA</th>
                            ${sortedBrands.map(b => `<th style="padding:6px 8px; text-align:center;">${b}</th>`).join('')}
                            <th style="padding:6px 8px; text-align:center; width:100px;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pagedSortedWeeks.length === 0 ? `<tr><td colspan="${sortedBrands.length + 2}" style="padding:3rem; text-align:center; color:rgba(167, 139, 250, 0.4); font-weight:700;">No hay datos semanales registrados.</td></tr>` : pagedSortedWeeks.map(w => {
                            const rowData = weeklyBrandData[w];
                            const rowTotal = sortedBrands.reduce((sum, b) => sum + (rowData[b] || 0), 0);
                            const isExpanded = window.__expandedStorageReportWeeks && window.__expandedStorageReportWeeks.includes(w);
                            
                            const genderRowsHtml = isExpanded ? Array.from(allGendersPerWeek[w] || []).sort().map(gender => {
                                const genderData = weeklyBrandGenderData[w][gender] || {};
                                const genderRowTotal = sortedBrands.reduce((sum, b) => sum + (genderData[b] || 0), 0);
                                return `
                                    <tr style="background: rgba(139, 92, 246, 0.04); border-bottom: 1px solid rgba(139,92,246,0.06); font-size:0.74rem;">
                                        <td style="padding:5px 8px 5px 24px; color:rgba(255,255,255,0.7); font-weight:600; font-style:italic; white-space:nowrap;">↳ ${gender}</td>
                                        ${sortedBrands.map(b => {
                                            const qty = genderData[b] || 0;
                                            return `<td style="padding:5px 8px; text-align:center; color:rgba(255,255,255,0.65);">${qty > 0 ? qty.toLocaleString() : '-'}</td>`;
                                        }).join('')}
                                        <td style="padding:5px 8px; text-align:center; color:#a78bfa; font-weight:700; background:rgba(139,92,246,0.04);">${genderRowTotal.toLocaleString()}</td>
                                    </tr>
                                `;
                            }).join('') : '';

                            return `
                                <tr onclick="window.toggleStorageReportWeek('${w}')" style="border-bottom: 1px solid rgba(139,92,246,0.08); background:#000000; cursor:pointer;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='#000000'">
                                    <td style="padding:6px 8px; color:#ffffff; font-weight:700; white-space:nowrap;">
                                        <span style="color:#8b5cf6; margin-right:6px; display:inline-block; transition: transform 0.2s; ${isExpanded ? 'transform: rotate(90deg);' : ''}">▶</span>
                                        ${w}
                                    </td>
                                    ${sortedBrands.map(b => {
                                        const qty = rowData[b] || 0;
                                        return `<td style="padding:6px 8px; text-align:center; color:${qty > 0 ? '#ffffff' : 'rgba(255,255,255,0.45)'}; font-weight:${qty > 0 ? '700' : '400'};">${qty > 0 ? qty.toLocaleString() : '0'}</td>`;
                                    }).join('')}
                                    <td style="padding:6px 8px; text-align:center; color:#a78bfa; font-weight:900; background:rgba(139,92,246,0.05);">${rowTotal.toLocaleString()}</td>
                                </tr>
                                ${genderRowsHtml}
                            `;
                        }).join('')}
                        ${sortedWeeks.length > 0 ? `
                            <tr style="background: linear-gradient(90deg, rgba(139,92,246,0.2) 0%, rgba(15, 23, 42, 0.8) 100%); border-top: 2px solid #8b5cf6; font-weight:900;">
                                <td style="padding:8px 8px; color:#ffffff; font-weight:900;">TOTAL GENERAL</td>
                                ${sortedBrands.map(b => {
                                    const qty = colTotals[b];
                                    return `<td style="padding:8px 8px; text-align:center; color:#a78bfa; font-weight:900;">${qty.toLocaleString()}</td>`;
                                }).join('')}
                                <td style="padding:8px 8px; text-align:center; color:#a78bfa; font-weight:900; background:rgba(139,92,246,0.1); text-shadow:0 0 8px rgba(167,139,250,0.5);">${grandTotal.toLocaleString()}</td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
            ${(() => {
                const tp = window.__weeklyTotalPages || 1;
                const cp = window.__weeklyPage || 0;
                if (tp <= 1) return '';
                const btnStyle = (active, dis) => `padding:4px 9px; border-radius:6px; border:1px solid #8b5cf6; background:${active?'rgba(139,92,246,0.25)':'rgba(255,255,255,0.03)'}; color:${dis?'rgba(255,255,255,0.2)':active?'#fff':'#a78bfa'}; cursor:${dis?'default':'pointer'}; font-size:0.7rem; font-weight:${active?900:500};`;
                const pages = Array.from({length: tp}, (_, i) => i);
                return `<div style="display:flex; align-items:center; justify-content:center; gap:5px; padding-top:0.6rem; border-top:1px solid rgba(139,92,246,0.2); margin-top:0.4rem;">
                    <button onclick="window.__weeklySetPage(${Math.max(0,cp-1)})" ${cp===0?'disabled':''} style="${btnStyle(false,cp===0)}">← Ant</button>
                    ${pages.map(p=>`<button onclick="window.__weeklySetPage(${p})" style="${btnStyle(p===cp,false)}">${p+1}</button>`).join('')}
                    <button onclick="window.__weeklySetPage(${Math.min(tp-1,cp+1)})" ${cp===tp-1?'disabled':''} style="${btnStyle(false,cp===tp-1)}">Sig →</button>
                    <span style="font-size:0.7rem; color:rgba(167,139,250,0.4); margin-left:6px;">Pág ${cp+1} / ${tp} (${window.__weeklyTotalRows || 0} registros)</span>
                </div>`;
            })()}
        </div>
        `;
    }

const renderWeeklyDailyChartSection = (tasksList) => {
        const chartWeeksData = {};

        const getWeekStr = (dateStr) => {
            if (!dateStr || dateStr === '---') return '---';
            const parts = dateStr.split('-');
            if (parts.length !== 3) return '---';
            const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
            const weekNo = getWeekNumber(dateObj);
            return `Semana ${weekNo} (${parts[0]})`;
        };

        const getDayIndex = (dateStr) => {
            if (!dateStr) return -1;
            const parts = dateStr.split('-');
            if (parts.length !== 3) return -1;
            const d = new Date(parts[0], parts[1] - 1, parts[2]);
            const day = d.getDay();
            return day === 0 ? 6 : day - 1;
        };

        const getActiveDayIndices = (startStr, endStr) => {
            if (!startStr || !endStr) return [0, 1, 2, 3, 4, 5];
            const startParts = startStr.split('-');
            const endParts = endStr.split('-');
            if (startParts.length !== 3 || endParts.length !== 3) return [0, 1, 2, 3, 4, 5];
            
            const startObj = new Date(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10));
            const endObj = new Date(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10));
            
            if (isNaN(startObj.getTime()) || isNaN(endObj.getTime()) || startObj > endObj) return [0, 1, 2, 3, 4, 5];
            
            // Si el rango es de 7 días o más, mostramos la semana completa
            const diffTime = Math.abs(endObj - startObj);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 6) {
                return [0, 1, 2, 3, 4, 5];
            }
            
            const active = new Set();
            let current = new Date(startObj.getTime());
            while (current <= endObj) {
                const day = current.getDay();
                const idx = day === 0 ? 6 : day - 1;
                if (idx !== 6) active.add(idx);
                current.setDate(current.getDate() + 1);
            }
            return Array.from(active).sort((a, b) => a - b);
        };

        const getTaskMetrics = (t) => {
            let qtyBuffer = 0;
            let avance = 0;
            (t.items || []).forEach(art => {
                const bufferItems = art.items || [];
                const cdbufferItems = bufferItems.filter(i => {
                    const ubi = String(i.ubi || '').toUpperCase();
                    return ubi.startsWith('CDBUFFER') && !ubi.startsWith('CDBUFFER-C');
                });

                cdbufferItems.forEach(i => {
                    const qty = parseFloat(i.qty) || 0;
                    qtyBuffer += qty;
                    if (t.status === 'Finalizado') {
                        avance += (i.avance !== undefined && i.avance !== null) ? parseFloat(i.avance) : qty;
                    }
                });
            });
            return { qtyBuffer, avance };
        };

        // dynamic default dates
        let minDate = '';
        let maxDate = '';
        tasksList.forEach(t => {
            if (t.status === 'Finalizado' && t.fecha) {
                if (!minDate || t.fecha < minDate) minDate = t.fecha;
                if (!maxDate || t.fecha > maxDate) maxDate = t.fecha;
            }
        });

        if (!window.__chartStartDate || !window.__chartEndDate) {
            const today = new Date();
            const day = today.getDay();
            const diff = today.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(today.getTime());
            monday.setDate(diff);
            monday.setHours(0,0,0,0);
            const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
            
            const toYYYYMMDD = (d) => {
                const yyyy = d.getFullYear();
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${yyyy}-${mm}-${dd}`;
            };
            
            window.__chartStartDate = toYYYYMMDD(monday);
            window.__chartEndDate = toYYYYMMDD(sunday);
        }

        const startDate = window.__chartStartDate || '';
        const endDate = window.__chartEndDate || '';

        const chartTasks = tasksList.filter(t => {
            if (!t.fecha) return false;
            if (startDate && t.fecha < startDate) return false;
            if (endDate && t.fecha > endDate) return false;
            return true;
        });

        chartTasks.forEach(t => {
            const weekStr = getWeekStr(t.fecha);
            const dayIdx = getDayIndex(t.fecha);
            if (weekStr === '---' || dayIdx === -1) return;
            
            if (!chartWeeksData[weekStr]) {
                chartWeeksData[weekStr] = {
                    qtyBuffer: [0, 0, 0, 0, 0, 0, 0],
                    avance: [0, 0, 0, 0, 0, 0, 0]
                };
            }
            const metrics = getTaskMetrics(t);
            chartWeeksData[weekStr].qtyBuffer[dayIdx] += metrics.qtyBuffer;
            chartWeeksData[weekStr].avance[dayIdx] += metrics.avance;
        });

        const activeWeeks = Object.keys(chartWeeksData).sort((a, b) => {
            const getVal = (s) => {
                const m = s.match(/Semana (\d+) \((\d+)\)/);
                if (!m) return 0;
                return parseInt(m[2]) * 100 + parseInt(m[1]);
            };
            return getVal(a) - getVal(b);
        });

        const displayWeeks = activeWeeks;

        setTimeout(() => {
            const ctx = document.getElementById('weeklyDailyChartCanvas');
            if (!ctx) {
                console.warn("⚠️ Canvas element 'weeklyDailyChartCanvas' not found in DOM yet.");
                return;
            }
            
            if (window.weeklyDailyChartInstance) {
                try {
                    window.weeklyDailyChartInstance.destroy();
                } catch(e) {
                    console.error("Error destroying chart instance:", e);
                }
            }
            
            if (typeof Chart === 'undefined') {
                console.error("❌ Chart.js is not loaded.");
                return;
            }
            
            const activeIndices = getActiveDayIndices(startDate, endDate);
            const allLabels = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
            const chartLabels = allLabels.filter((_, idx) => activeIndices.includes(idx));

            const datasets = [];
            displayWeeks.forEach((week, idx) => {
                const labelSuffix = displayWeeks.length > 1 ? ` (${week})` : '';
                
                // Qty Buffer dataset
                const bufferColor = { border: '#00E5FF', bg: 'rgba(0, 229, 255, 0.05)' };
                const filteredBufferData = chartWeeksData[week].qtyBuffer.filter((_, dIdx) => activeIndices.includes(dIdx));
                datasets.push({
                    label: `Qty Buffer${labelSuffix}`,
                    data: filteredBufferData,
                    borderColor: bufferColor.border,
                    backgroundColor: bufferColor.bg,
                    borderWidth: 3,
                    pointBackgroundColor: bufferColor.border,
                    pointBorderColor: '#ffffff',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.35,
                    fill: true
                });

                // Avance dataset
                const avanceColor = { border: '#eab308', bg: 'rgba(234, 179, 8, 0.05)' };
                const filteredAvanceData = chartWeeksData[week].avance.filter((_, dIdx) => activeIndices.includes(dIdx));
                datasets.push({
                    label: `Avance${labelSuffix}`,
                    data: filteredAvanceData,
                    borderColor: avanceColor.border,
                    backgroundColor: avanceColor.bg,
                    borderWidth: 3,
                    pointBackgroundColor: avanceColor.border,
                    pointBorderColor: '#ffffff',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    tension: 0.35,
                    fill: true
                });
            });

            if (displayWeeks.length > 0) {
                let totalSum = 0;
                let totalDays = 0;
                displayWeeks.forEach(week => {
                    activeIndices.forEach(idx => {
                        totalSum += chartWeeksData[week].qtyBuffer[idx] || 0;
                        totalDays++;
                    });
                });
                const overallAverage = totalDays > 0 ? Math.round(totalSum / totalDays) : 0;
                const averageData = activeIndices.map(() => overallAverage);
                
                datasets.push({
                    label: 'Promedio',
                    data: averageData,
                    borderColor: '#ef4444',
                    backgroundColor: 'transparent',
                    borderWidth: 3,
                    borderDash: [8, 4],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    tension: 0,
                    fill: false
                });
            }
            
            const datalabelsPlugin = {
                id: 'datalabels',
                afterDatasetsDraw(chart) {
                    const ctx = chart.ctx;
                    chart.data.datasets.forEach((dataset, i) => {
                        if (dataset.label === 'Promedio') return;
                        const meta = chart.getDatasetMeta(i);
                        if (meta.hidden) return;
                        meta.data.forEach((point, index) => {
                            const val = dataset.data[index];
                            if (val === undefined || val === null) return;
                            
                            ctx.save();
                            ctx.fillStyle = dataset.borderColor || '#ffffff';
                            ctx.font = 'bold 11px "Inter", sans-serif';
                            let yOffset = -8;
                            ctx.textBaseline = 'bottom';
                            if (i % 2 !== 0) {
                                ctx.textBaseline = 'top';
                                yOffset = 8;
                            }
                            
                            // Sombra negra para máxima legibilidad sobre cualquier cuadrícula o fondo
                            ctx.shadowColor = '#000000';
                            ctx.shadowBlur = 4;
                            ctx.shadowOffsetX = 0;
                            ctx.shadowOffsetY = 1;
                            
                            ctx.fillText(val.toLocaleString(), point.x, point.y + yOffset);
                            ctx.restore();
                        });
                    });
                }
            };
            
            window.weeklyDailyChartInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: chartLabels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false,
                            position: 'top',
                            labels: {
                                color: '#e2e8f0',
                                font: {
                                    family: "'Outfit', sans-serif",
                                    weight: 'bold',
                                    size: 11
                                }
                            }
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            backgroundColor: 'rgba(15, 23, 42, 0.95)',
                            titleColor: '#fef08a',
                            bodyColor: '#ffffff',
                            borderColor: '#eab308',
                            borderWidth: 1.5,
                            titleFont: { family: "'Outfit', sans-serif", weight: '900', size: 13 },
                            bodyFont: { family: "'Inter', sans-serif", size: 12 },
                            padding: 12,
                            cornerRadius: 10,
                            boxPadding: 8,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    const val = context.parsed.y;
                                    if (val !== null && val !== undefined) {
                                        return ` ${label}: ${val.toLocaleString()}`;
                                    }
                                    return ` ${label}`;
                                }
                            }
                        }
                    },
                    layout: {
                        padding: {
                            left: 25,
                            right: 25,
                            top: 20,
                            bottom: 10
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)',
                                borderColor: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#94a3b8',
                                font: { family: "'Inter', sans-serif", weight: '600' }
                            }
                        },
                        y: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)',
                                borderColor: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: '#94a3b8',
                                font: { family: "'Inter', sans-serif", weight: '600' }
                            },
                            beginAtZero: true
                        }
                    }
                },
                plugins: [datalabelsPlugin]
            });
        }, 100);

        return `
        <!-- GRÁFICO POR SEMANA Y DÍA -->
        <div style="background:#000000; border:2px solid #eab308; border-radius:12px; padding:0.8rem 1.2rem; box-shadow: 0 0 25px rgba(234,179,8,0.2); font-family:var(--font-sans, 'Inter', sans-serif); color:#fff; display:flex; flex-direction:column; gap:0.6rem; margin-top:1.5rem; width:100%;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:1px solid rgba(234,179,8,0.15); padding-bottom:8px;">
                <div style="border-left: 4px solid #eab308; padding-left: 10px; display:flex; flex-direction:column; gap:2px;">
                    <h3 style="color:#fef08a; font-weight:900; margin:0; font-size:1rem; letter-spacing:1.5px; text-transform:uppercase; font-family:'Outfit', sans-serif;">
                        GRÁFICO DE RENDIMIENTO SEMANA Y DÍA
                    </h3>
                    <div style="font-size:0.68rem; color:rgba(234, 179, 8, 0.6); font-weight:700; letter-spacing:0.5px;">
                        TENDENCIAS DIARIAS COMPARADAS POR SEMANAS (LUNES A SÁBADO)
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; font-family:'Inter', sans-serif;">
                    <div style="display:flex; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:4px 10px; gap:8px;">
                        <span style="font-size:0.85rem; color:#eab308;">📅</span>
                        <span style="font-size:0.7rem; color:rgba(255,255,255,0.4); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Desde:</span>
                        <input type="date" id="chartStartDateInput" value="${window.__chartStartDate}" onchange="window.setChartDateRange(this.value, null)" style="background:transparent; border:none; color:#fff; font-size:0.75rem; font-weight:700; outline:none; cursor:pointer; font-family:'Inter', sans-serif; color-scheme:dark;" />
                    </div>
                    <div style="display:flex; align-items:center; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); border-radius:8px; padding:4px 10px; gap:8px;">
                        <span style="font-size:0.85rem; color:#eab308;">📅</span>
                        <span style="font-size:0.7rem; color:rgba(255,255,255,0.4); font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Hasta:</span>
                        <input type="date" id="chartEndDateInput" value="${window.__chartEndDate}" onchange="window.setChartDateRange(null, this.value)" style="background:transparent; border:none; color:#fff; font-size:0.75rem; font-weight:700; outline:none; cursor:pointer; font-family:'Inter', sans-serif; color-scheme:dark;" />
                    </div>
                </div>
            </div>
            <div style="position:relative; width:100%; height:250px; margin-top:0.5rem;">
                <canvas id="weeklyDailyChartCanvas" style="width:100%; height:100%; max-height:250px;"></canvas>
            </div>
        </div>
        `;
    }

