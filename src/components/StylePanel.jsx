import { Field, Seg, Select } from './ui';

// Controles de estilo de un elemento de la web. `style` son solo los cambios; `cur` el estilo actual en la página.
const WEIGHTS = [['', 'Como está'], ['400', 'Normal'], ['500', 'Medio'], ['600', 'Semi negrita'], ['700', 'Negrita'], ['800', 'Extra negrita'], ['900', 'Máxima']];

function ColorRow({ label, value, fallback, onChange }) {
  return (
    <Field label={label}>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input type="color" value={value || fallback || '#000000'} onChange={(e) => onChange(e.target.value)} style={{ width: 48, height: 34, padding: 2 }} />
        <span className="small muted grow">{value ? value.toUpperCase() : 'Como está'}</span>
        {value && <button className="btn sm ghost" onClick={() => onChange('')}>Quitar</button>}
      </div>
    </Field>
  );
}

function Slider({ label, value, fallback, min, max, step = 1, unit = 'px', onChange }) {
  const has = value !== undefined && value !== '';
  const v = has ? Number(value) : fallback ?? min;
  return (
    <Field label={`${label}: ${has ? `${v}${unit}` : 'como está'}`}>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input type="range" className="grow" min={min} max={max} step={step} value={v} onChange={(e) => onChange(Number(e.target.value))} />
        {has && <button className="btn sm ghost" onClick={() => onChange('')}>Quitar</button>}
      </div>
    </Field>
  );
}

export default function StylePanel({ style = {}, cur = {}, isImg, isBtn, outline, variant, show, onStyle, onVariant, onShow }) {
  const set = (k) => (v) => onStyle({ ...style, [k]: v });
  return (
    <div className="col" style={{ gap: 12 }}>
      {!isImg && (
        <>
          <Slider label="Tamaño de letra" value={style.size} fallback={cur.size} min={10} max={110} onChange={set('size')} />
          <div className="grid g2">
            <ColorRow label="Color del texto" value={style.color} fallback={cur.color} onChange={set('color')} />
            <ColorRow label="Color de fondo" value={style.bg} fallback={cur.bg || '#ffffff'} onChange={set('bg')} />
          </div>
          <div className="grid g2">
            <Select label="Grosor" value={style.weight || ''} onChange={set('weight')} options={WEIGHTS.map(([value, label]) => ({ value, label }))} />
            <Select label="Mayúsculas" value={style.transform || ''} onChange={set('transform')} options={[{ value: '', label: 'Como está' }, { value: 'uppercase', label: 'TODO MAYÚSCULAS' }, { value: 'none', label: 'Normal' }]} />
          </div>
          <div className="row">
            <Seg value={style.italic === true ? 'i' : style.italic === false ? 'n' : ''} onChange={(v) => set('italic')(v === 'i' ? true : v === 'n' ? false : '')}
              options={[{ value: '', label: 'Como está' }, { value: 'i', label: <i>Cursiva</i> }, { value: 'n', label: 'Recta' }]} />
          </div>
          <Field label="Alineación">
            <Seg value={style.align || ''} onChange={set('align')} options={[{ value: '', label: 'Como está' }, { value: 'left', label: 'Izquierda' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Derecha' }]} />
          </Field>
          <Slider label="Interlineado" value={style.lh} min={0.8} max={2.4} step={0.05} unit="" fallback={1.4} onChange={set('lh')} />
          <Slider label="Espacio entre letras" value={style.spacing} min={-2} max={8} step={0.5} fallback={0} onChange={set('spacing')} />
        </>
      )}
      {isImg && <Slider label="Ancho" value={style.width} min={10} max={100} unit="%" fallback={100} onChange={set('width')} />}
      <div className="grid g2">
        <Slider label="Espacio arriba" value={style.mt} min={-20} max={160} fallback={0} onChange={set('mt')} />
        <Slider label="Espacio abajo" value={style.mb} min={-20} max={160} fallback={0} onChange={set('mb')} />
      </div>
      {(isBtn || isImg || style.bg) && <Slider label="Esquinas redondeadas" value={style.radius} min={0} max={60} fallback={isBtn ? 999 : 0} onChange={set('radius')} />}
      {style.bg && <Slider label="Relleno interno" value={style.pad} min={0} max={60} fallback={0} onChange={set('pad')} />}
      {isBtn && (
        <Field label="Estilo del botón">
          <Seg value={variant || (outline ? 'outline' : 'solid')} onChange={onVariant} options={[{ value: 'solid', label: 'Relleno' }, { value: 'outline', label: 'Solo borde' }]} />
        </Field>
      )}
      <Field label="Mostrar en">
        <Seg value={show || ''} onChange={onShow} options={[{ value: '', label: 'Todos' }, { value: 'desktop', label: 'Solo computadora' }, { value: 'mobile', label: 'Solo celular' }]} />
      </Field>
      {Object.keys(style).length > 0 && <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => onStyle({})}>Quitar todos los estilos</button>}
    </div>
  );
}
