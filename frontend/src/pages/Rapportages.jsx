import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { formatDateNL, getWeekNumber, getMonday, addDays } from '../utils/dates';

export default function Rapportages() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('week');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedDate]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      // In a real app, this would fetch from API
      // For now, we'll generate sample data
      await new Promise(r => setTimeout(r, 500));
      
      const sampleData = {
        totaalUren: 156,
        totaalKosten: 2340.00,
        medewerkers: [
          { naam: 'Jan Jansen', uren: 40, kosten: 600, contractUren: 40, overtime: 0 },
          { naam: 'Piet Pietersen', uren: 38, kosten: 570, contractUren: 40, overtime: 0 },
          { naam: 'Klaas Kansen', uren: 42, kosten: 672, contractUren: 40, overtime: 2 },
          { naam: 'Marie Mulder', uren: 36, kosten: 498, contractUren: 32, overtime: 4 },
        ],
        afdelingen: [
          { naam: 'Kassa', uren: 60, kosten: 900 },
          { naam: 'Magazijn', uren: 48, kosten: 720 },
          { naam: 'Vers', uren: 32, kosten: 480 },
          { naam: 'Vulploeg', uren: 16, kosten: 240 },
        ]
      };
      setData(sampleData);
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportToCsv = () => {
    if (!data) return;
    
    let csv = 'Naam,Uren,Kosten,Contract Uren,Overwerk\n';
    data.medewerkers.forEach(m => {
      csv += `${m.naam},${m.uren},€${m.kosten.toFixed(2)},${m.contractUren},${m.overtime}\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-${selectedDate}.csv`;
    a.click();
  };

  const exportToPdf = () => {
    window.print();
  };

  if (user?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Je hebt geen toegang tot deze pagina.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header - hide on print */}
      <div className="flex justify-between items-center print:hidden">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rapportages</h1>
        <div className="flex gap-2">
          <button
            onClick={exportToCsv}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            📥 CSV Export
          </button>
          <button
            onClick={exportToPdf}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            🖨️ Printen / PDF
          </button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block">
        <h1 className="text-2xl font-bold">Personeelsrapportage</h1>
        <p className="text-gray-600">Periode: {reportType === 'week' ? 'Week' : 'Maand'} van {formatDateNL(new Date(selectedDate))}</p>
      </div>

      {/* Filters - hide on print */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md flex gap-4 print:hidden">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type rapport</label>
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-white"
          >
            <option value="week">Per Week</option>
            <option value="maand">Per Maand</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Datum</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 dark:bg-gray-700 dark:text-white"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Rapport laden...</p>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md print:shadow-none print:border">
              <p className="text-sm text-gray-500 dark:text-gray-400">Totaal Uren</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{data.totaalUren}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md print:shadow-none print:border">
              <p className="text-sm text-gray-500 dark:text-gray-400">Geschatte Kosten</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">€{data.totaalKosten.toFixed(2)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md print:shadow-none print:border">
              <p className="text-sm text-gray-500 dark:text-gray-400">Medewerkers Actief</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{data.medewerkers.length}</p>
            </div>
          </div>

          {/* Per Employee Table */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden print:shadow-none print:border">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <h2 className="font-semibold text-gray-900 dark:text-white">Uren per Medewerker</h2>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Naam</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Gewerkt</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Contract</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Overwerk</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 dark:text-gray-300">Kosten</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                {data.medewerkers.map((m, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{m.naam}</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{m.uren}u</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{m.contractUren}u</td>
                    <td className="px-4 py-3 text-right">
                      {m.overtime > 0 ? (
                        <span className="text-red-600">+{m.overtime}u</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-white font-medium">€{m.kosten.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Totaal</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">{data.totaalUren}u</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">€{data.totaalKosten.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Per Department */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden print:shadow-none print:border">
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <h2 className="font-semibold text-gray-900 dark:text-white">Uren per Afdeling</h2>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                {data.afdelingen.map((a, i) => (
                  <div key={i}>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-700 dark:text-gray-300">{a.naam}</span>
                      <span className="text-gray-900 dark:text-white font-medium">{a.uren}u (€{a.kosten.toFixed(2)})</span>
                    </div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${(a.uren / data.totaalUren) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="text-gray-500">Geen data beschikbaar</p>
      )}
    </div>
  );
}