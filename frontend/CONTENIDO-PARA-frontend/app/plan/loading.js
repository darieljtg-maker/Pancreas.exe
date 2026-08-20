import Esqueleto, { Encabezado, Tarjeta, Fila } from '@/components/Esqueleto';

export default function Cargando() {
  return (
    <Esqueleto>
      <Encabezado />
      <Fila columnas={4} />
      <Tarjeta className="h-14" />
      <Tarjeta className="h-20" />
      <Tarjeta className="h-48" />
      <Tarjeta className="h-14" />
    </Esqueleto>
  );
}
