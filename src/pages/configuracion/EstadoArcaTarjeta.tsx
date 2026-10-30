import { useQuery } from '@tanstack/react-query';
import { Tarjeta } from '@/components/ui';
import { ambienteTexto, cuit, fecha } from '@/lib/formato';
import type { EstadoArca } from '@/lib/tipos';
import { useApi } from '@/lib/useApi';

export function EstadoArcaTarjeta() {
  const { pedir } = useApi();
  const { data } = useQuery({ queryKey: ['arca'], queryFn: () => pedir<EstadoArca>('/configuracion/arca') });
  if (!data) return null;

  return (
    <Tarjeta titulo="Conexión con ARCA">
      <dl className="grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1">
          <dt className="fk-etiqueta">Ambiente</dt>
          <dd className="font-medium">{ambienteTexto(data.ambiente)}</dd>
        </div>
        <div className="space-y-1">
          <dt className="fk-etiqueta">CUIT con el que se emite</dt>
          <dd className="font-medium tabular-nums">
            {cuit(data.cuitEmision)}
            {data.usaCuitPrueba && <span className="ml-1 text-xs font-normal text-fk-pendiente-texto">(CUIT de prueba)</span>}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="fk-etiqueta">Certificado</dt>
          <dd className="font-medium">
            {data.certificado ? `Vence el ${fecha(data.certificado.venceEl)}` : data.ambiente === 'HOMOLOGACION' ? 'No hace falta en pruebas' : 'Falta cargarlo'}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="fk-etiqueta">Servicio AfipSDK</dt>
          <dd className={`font-medium ${data.afipSdkConfigurado ? 'text-fk-ok-texto' : 'text-fk-error-texto'}`}>
            {data.afipSdkConfigurado ? 'Configurado' : 'Falta configurar en el servidor'}
          </dd>
        </div>
      </dl>
      {data.usaCuitPrueba && (
        <p className="mt-4 text-xs text-fk-gris-texto">
          En pruebas, sin certificado propio, ARCA recibe el CUIT de prueba de AfipSDK y un cliente de prueba. El PDF
          muestra tus datos reales con la marca "Comprobante de prueba – sin validez fiscal".
        </p>
      )}
    </Tarjeta>
  );
}
