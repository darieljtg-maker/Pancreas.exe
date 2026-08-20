import Esqueleto, { Encabezado, Tarjeta, Fila } from '@/components/Esqueleto';

export default function Cargando() {
  return (
    <Esqueleto>
      <Encabezado />
      <Tarjeta className="h-52" />
      <Fila columnas={3} />
      <Tarjeta className="h-28" />
      <Tarjeta className="h-40" />
    </Esqueleto>
  );
}
