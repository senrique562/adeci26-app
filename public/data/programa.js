// Programa ADECI26 — fuente: https://adeci.org.ar/congresos/2026/programa.html
// Cada sesión tiene un id estable. Los cambios de último momento se hacen desde el panel
// (título y participantes) y se aplican encima de este archivo sin tocarlo.
//
// tipo: 'sesion' | 'simposio' | 'taller' | 'posters' | 'pausa' | 'acto'
// Los participantes son ids de speakers.js cuando hay perfil; si no, texto plano.

export const DIAS = [
  { n: 1, fecha: '2026-09-17', label: 'Jueves 17', corto: 'Jue 17' },
  { n: 2, fecha: '2026-09-18', label: 'Viernes 18', corto: 'Vie 18' },
];

export const EJES = {
  ram:     { nombre: 'Resistencia antimicrobiana', clase: 'e-ram' },
  ester:   { nombre: 'Esterilización y DAN', clase: 'e-ester' },
  iaas:    { nombre: 'Prevención de IAAS', clase: 'e-iaas' },
  amb:     { nombre: 'Seguridad ambiental', clase: 'e-amb' },
  sp:      { nombre: 'Salud pública y emergencias', clase: 'e-sp' },
  ia:      { nombre: 'IA y Big Data', clase: 'e-ia' },
  lider:   { nombre: 'Liderazgo y formación', clase: 'e-lider' },
  cuidado: { nombre: 'Cuidado y humanización', clase: 'e-cuidado' },
  libres:  { nombre: 'Trabajos libres', clase: 'e-libres' },
};

export const PROGRAMA = [
  // ───────────── JUEVES 17 ─────────────
  { id: 'd1-01', dia: 1, ini: '07:30', fin: '08:30', tipo: 'pausa', titulo: 'Acreditación' },
  { id: 'd1-02', dia: 1, ini: '08:30', fin: '08:45', tipo: 'acto', titulo: 'Apertura oficial' },
  { id: 'd1-03', dia: 1, ini: '08:45', fin: '12:00', tipo: 'taller', eje: 'ram',
    titulo: 'Documento de Consenso Interinstitucional · OMR: qué vigilar y cuándo desaislar',
    sub: 'Taller ADECI · INE · SADI',
    roles: [{ rol: 'Disertantes', ids: ['gonzalez', 'alonso', 'alvarez', 'colque'] }] },
  { id: 'd1-04', dia: 1, ini: '12:00', fin: '13:00', tipo: 'posters', titulo: 'Recorrida de pósters' },
  { id: 'd1-05', dia: 1, ini: '13:00', fin: '13:50', tipo: 'sesion', eje: 'ram',
    titulo: 'La multirresistencia contraataca',
    roles: [{ rol: 'Moderadora', ids: ['laurito'] }, { rol: 'Disertantes', ids: ['alonso', 'colque'] }] },
  { id: 'd1-06', dia: 1, ini: '13:50', fin: '14:30', tipo: 'sesion', eje: 'ester',
    titulo: 'Desinfección de alto nivel y esterilización',
    roles: [{ rol: 'Moderadora', ids: ['ilari'] }, { rol: 'Disertante', ids: ['guerra'] }] },
  { id: 'd1-07', dia: 1, ini: '14:30', fin: '14:45', tipo: 'pausa', titulo: 'Intervalo' },
  { id: 'd1-08', dia: 1, ini: '14:45', fin: '15:30', tipo: 'sesion', eje: 'amb',
    titulo: 'Agua en el hospital: del reservorio invisible al riesgo real',
    roles: [{ rol: 'Moderador', ids: ['ayala'] }, { rol: 'Disertante', ids: ['fravega'] }, { rol: 'Panelista', ids: ['alonso'] }] },
  { id: 'd1-09', dia: 1, ini: '15:30', fin: '16:00', tipo: 'simposio', eje: 'amb',
    titulo: 'Biofilm y limpieza de superficies: mitos y realidades',
    sub: 'Simposio MEDIFAR',
    roles: [{ rol: 'Disertante', ids: ['campos'] }] },
  { id: 'd1-10', dia: 1, ini: '16:00', fin: '16:45', tipo: 'posters', titulo: 'Recorrida de pósters' },
  { id: 'd1-11', dia: 1, ini: '16:45', fin: '17:30', tipo: 'sesion', eje: 'iaas',
    titulo: 'Dispositivos invasivos y seguridad del paciente',
    roles: [{ rol: 'Moderadora', ids: ['bravo'] }, { rol: 'Disertantes', ids: ['meyer', 'vargas'] }] },
  { id: 'd1-12', dia: 1, ini: '17:30', fin: '18:30', tipo: 'sesion', eje: 'sp',
    titulo: 'Salud pública y Seguridad Nacional',
    roles: [
      { rol: 'Moderadora', ids: ['medina'] },
      { rol: 'Panelistas', ids: ['guzman', 'bulacio', 'licata'],
        temas: { guzman: 'Catástrofes naturales', bulacio: 'Bioterrorismo', licata: 'Nuevas pandemias' } },
    ] },
  { id: 'd1-13', dia: 1, ini: '18:30', fin: '19:30', tipo: 'acto', eje: 'lider',
    titulo: 'Un legado que inspira: palabras de nuestras pioneras a las nuevas generaciones',
    sub: 'Mística, ciencia y coraje: charla de café con las pioneras · Reunión societaria' },

  // ───────────── VIERNES 18 ─────────────
  { id: 'd2-01', dia: 2, ini: '08:00', fin: '09:00', tipo: 'sesion', eje: 'cuidado',
    titulo: 'Cuidar hasta el último momento',
    roles: [{ rol: 'Moderadora', ids: ['suayter'] }, { rol: 'Panelistas', ids: ['bracamonte', 'gerez'] }] },
  { id: 'd2-02', dia: 2, ini: '09:00', fin: '09:45', tipo: 'sesion', eje: 'lider',
    titulo: 'Líderes en control de infecciones',
    roles: [
      { rol: 'Moderadora', ids: ['azario'] },
      { rol: 'Disertantes', ids: ['gonzalez', 'brenner'],
        temas: { gonzalez: 'Líderes en control de infecciones: estrategia clave', brenner: 'Formadores de líderes: desafíos' } },
    ] },
  { id: 'd2-03', dia: 2, ini: '09:45', fin: '10:15', tipo: 'sesion', eje: 'libres',
    titulo: 'Presentación oral de trabajos libres',
    roles: [
      { rol: 'Moderadora', ids: ['vazquez'] },
      { rol: 'Jurado', ids: ['cuadrado', 'gerez', 'Lic. Milagros Mena', 'meyer', 'silva'] },
    ] },
  { id: 'd2-04', dia: 2, ini: '10:15', fin: '11:00', tipo: 'sesion', eje: 'amb',
    titulo: 'Biofilms: el enemigo oculto',
    roles: [{ rol: 'Moderadora', ids: ['novau'] }, { rol: 'Disertantes', ids: ['loza', 'capra'] }] },
  { id: 'd2-05', dia: 2, ini: '11:00', fin: '11:30', tipo: 'simposio', eje: 'iaas',
    titulo: 'Comprender para intervenir: decisiones clave en la ruta de la contaminación de los accesos vasculares',
    sub: 'Simposio ICU Medical',
    roles: [{ rol: 'Experto', ids: ['moraes'] }] },
  { id: 'd2-06', dia: 2, ini: '11:30', fin: '12:15', tipo: 'sesion', eje: 'lider',
    titulo: 'Panel · Comité Superior de Certificación de ADECI',
    roles: [{ rol: 'Panelistas', ids: ['alcala', 'azario', 'novau', 'vernazzi'] }] },
  { id: 'd2-07', dia: 2, ini: '12:15', fin: '12:45', tipo: 'simposio', eje: 'amb',
    titulo: 'Impacto de la lavandería en infecciones intrahospitalarias',
    sub: 'Simposio Diversey',
    roles: [{ rol: 'Especialista', ids: ['Fabián Mateo'] }] },
  { id: 'd2-08', dia: 2, ini: '12:45', fin: '13:30', tipo: 'pausa', titulo: 'Almuerzo' },
  { id: 'd2-09', dia: 2, ini: '13:30', fin: '14:00', tipo: 'sesion',
    titulo: 'ORANGE Argentina',
    roles: [{ rol: 'Moderadora', ids: ['suayter'] }, { rol: 'Disertante', ids: ['gonzalez'] }] },
  { id: 'd2-10', dia: 2, ini: '14:00', fin: '15:00', tipo: 'sesion', eje: 'iaas',
    titulo: 'ISQ · Cirugía robótica y prevención de IAAS',
    roles: [{ rol: 'Moderadora', ids: ['culaciati'] }, { rol: 'Disertantes', ids: ['silva', 'lizarraga', 'caparros'] }] },
  { id: 'd2-11', dia: 2, ini: '15:00', fin: '16:15', tipo: 'sesion', eje: 'iaas',
    titulo: 'Rival encubierto en áreas de reconstitución',
    roles: [
      { rol: 'Moderadora', ids: ['ayalazulma'] },
      { rol: 'Disertantes', ids: ['cobanera', 'basquiera', 'delgado', 'suayter'],
        temas: { cobanera: 'Cabinas biológicas', basquiera: 'Unidad de trasplante', delgado: 'Unidad de mezcla', suayter: 'Andamiaje con el control de infecciones' } },
    ] },
  { id: 'd2-12', dia: 2, ini: '16:15', fin: '16:30', tipo: 'pausa', titulo: 'Intervalo' },
  { id: 'd2-13', dia: 2, ini: '16:30', fin: '17:30', tipo: 'sesion', eje: 'ia',
    titulo: 'Inteligencia Artificial',
    roles: [
      { rol: 'Moderadora', ids: ['vernazzi'] },
      { rol: 'Disertantes', ids: ['miranda', 'rodriguez'],
        temas: { miranda: 'IA como aliado estratégico del ECI', rodriguez: 'Diseño de prompts · Anticipar enfermedades con IA y Big Data' } },
    ] },
  { id: 'd2-14', dia: 2, ini: '17:30', fin: '18:00', tipo: 'simposio', eje: 'amb',
    titulo: 'Dejemos de trabajar a ciegas: uso del Bactiscan para la detección superficial de materia orgánica y biofilms',
    sub: 'Simposio SKILL',
    roles: [{ rol: 'Expertos', ids: ['Ing. Francisco Tangari', 'miranda'] }] },
  { id: 'd2-15', dia: 2, ini: '18:00', fin: '18:30', tipo: 'sesion', eje: 'amb',
    titulo: 'Lavaderos del futuro · Diseño inteligente',
    roles: [{ rol: 'Moderadora', ids: ['gerez'] }, { rol: 'Experta', ids: ['cuadrado'] }] },
  { id: 'd2-16', dia: 2, ini: '18:30', fin: '19:30', tipo: 'acto',
    titulo: 'Entrega de diplomas CECIs/RECIs 2025-2029 · Clausura' },
];

// Sesiones sobre las que se puede dejar comentario (momento 4): todo lo que no sea pausa/pósters.
export const COMENTABLES = PROGRAMA.filter(s => !['pausa', 'posters'].includes(s.tipo)).map(s => s.id);
