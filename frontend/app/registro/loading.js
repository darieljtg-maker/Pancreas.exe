import Esqueleto, { Encabezado, Tarjeta } from '@/components/Esqueleto';

export default function Cargando() {
  return (
    <Esqueleto>
      <Encabezado />
      <Tarjeta className="h-12" />
      <Tarjeta className="h-72" />
    </Esqueleto>
  );
}
