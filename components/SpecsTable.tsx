interface SpecsTableProps {
  specs: Record<string, string>;
}

const PRIORITY_SPECS = [
  "Procesador",
  "Capacidad total del módulo de memoria RAM",
  "Capacidad",
  "Resoluciones máximas de las pantallas",
  "Tamaños de las pantallas",
  "Cantidad máxima de FPS",
  "Duración máxima de la batería",
  "Capacidad de la batería",
  "Tipo de consola",
  "Con Wi-Fi",
  "Con Bluetooth",
  "Con pantalla táctil",
  "Con HDMI",
  "Tipos de memoria",
  "Peso",
  "Año de lanzamiento",
];

export default function SpecsTable({ specs }: SpecsTableProps) {
  const ordered = [
    ...PRIORITY_SPECS.filter((k) => k in specs).map((k) => [k, specs[k]] as [string, string]),
    ...Object.entries(specs).filter(([k]) => !PRIORITY_SPECS.includes(k)),
  ];

  return (
    <section className="my-12">
      <h2 className="text-2xl font-bold text-gray-900 mb-5">
        Especificaciones técnicas
      </h2>
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <tbody>
            {ordered.map(([key, value], i) => (
              <tr
                key={key}
                className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <td className="py-3 px-5 font-medium text-gray-600 w-2/5 border-b border-gray-100">
                  {key}
                </td>
                <td className="py-3 px-5 text-gray-900 border-b border-gray-100 font-semibold">
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
