import Esqueleto, { Encabezado, Tarjeta, Fila } from '@/components/Esqueleto';

export default function Cargando() {
  return (
    <Esqueleto>
      <Encabezado />
      <Tarjeta className="h-12" />
      <Fila columnas={4} />
      <Tarjeta className="h-64" />
      <Tarjeta className="h-40" />
    </Esqueleto>
  );
}
