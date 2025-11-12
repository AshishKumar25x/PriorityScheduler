import React, { useState, useCallback, useMemo } from 'react';
import { Trash2, PlusCircle } from 'lucide-react';

// --- 1. Type Definitions ---

interface Process {
    id: number;
    pid: string;
    arrival: number;
    burst: number;
    priority: number; // Lower number means higher priority
    remaining: number;
    completionTime: number;
    turnaroundTime: number;
    waitingTime: number;
    startTimes: number[];
}

interface GanttSegment {
    pid: string;
    start: number;
    end: number;
    id?: number;
}

interface Metrics {
    avgTAT: number;
    avgWT: number;
    cpuUtil: number;
    totalTime: number;
}

// --- 2. Core Simulation Logic ---

const runPrioritySimulation = (initialProcesses: Process[]) => {
    const processes: Process[] = JSON.parse(JSON.stringify(initialProcesses));
    let currentTime = 0;
    const ganttChart: GanttSegment[] = [];
    let idleTime = 0;
    let lastProcessId: string | null = null;
    let isIdle = false;

    while (processes.some(p => p.remaining > 0)) {
        let readyQueue = processes.filter(p => p.arrival <= currentTime && p.remaining > 0);

        if (readyQueue.length === 0) {
            if (!isIdle) {
                ganttChart.push({ pid: 'IDLE', start: currentTime, end: currentTime + 1 });
                isIdle = true;
            } else {
                ganttChart[ganttChart.length - 1].end = currentTime + 1;
            }
            idleTime++;
            currentTime++;
            lastProcessId = null;
            continue;
        }

        readyQueue.sort((a, b) => {
            // Priority sort (lowest P first)
            if (a.priority !== b.priority) return a.priority - b.priority;
            // Tie-breaker: Arrival time
            return a.arrival - b.arrival;
        });

        const runningProcess = readyQueue[0];

        if (runningProcess.pid !== lastProcessId) {
            ganttChart.push({ pid: runningProcess.pid, start: currentTime, end: currentTime + 1, id: runningProcess.id });
            isIdle = false;

            if (runningProcess.startTimes.length === 0) {
                runningProcess.startTimes.push(currentTime);
            }
        } else {
            ganttChart[ganttChart.length - 1].end = currentTime + 1;
        }

        runningProcess.remaining--;
        currentTime++;
        lastProcessId = runningProcess.pid;

        if (runningProcess.remaining === 0) {
            runningProcess.completionTime = currentTime;
            runningProcess.turnaroundTime = runningProcess.completionTime - runningProcess.arrival;
            runningProcess.waitingTime = runningProcess.turnaroundTime - runningProcess.burst;
        }
    }

    const totalExecutionTime = ganttChart.length > 0 ? ganttChart[ganttChart.length - 1].end : 0;
    return { processes, gantt: ganttChart, totalTime: totalExecutionTime, idleTime };
};

// --- 3. Initial Data ---

const initialProcesses: Process[] = [
    { id: 1, pid: 'P1', arrival: 0, burst: 8, priority: 2, remaining: 8, completionTime: 0, turnaroundTime: 0, waitingTime: 0, startTimes: [] },
    { id: 2, pid: 'P2', arrival: 1, burst: 4, priority: 1, remaining: 4, completionTime: 0, turnaroundTime: 0, waitingTime: 0, startTimes: [] },
    { id: 3, pid: 'P3', arrival: 2, burst: 9, priority: 4, remaining: 9, completionTime: 0, turnaroundTime: 0, waitingTime: 0, startTimes: [] },
];

const initialMetrics: Metrics = { avgTAT: 0, avgWT: 0, cpuUtil: 0, totalTime: 0 };

const COLOR_CLASSES = [
    'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-lime-400',
    'bg-green-400', 'bg-sky-400', 'bg-indigo-400', 'bg-violet-400'
];

const getColorClass = (id: number | undefined): string => {
    if (!id) return 'bg-gray-200 text-gray-700';
    return COLOR_CLASSES[(id - 1) % COLOR_CLASSES.length];
};

// --- 4. React Component ---

export default function App() {
    const [inputProcesses, setInputProcesses] = useState<Process[]>(initialProcesses);
    const [resultProcesses, setResultProcesses] = useState<Process[]>(initialProcesses);
    const [gantt, setGantt] = useState<GanttSegment[]>([]);
    const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [processCounter, setProcessCounter] = useState(4);

    // RESTORED essential custom styles
    const customStyles = `
        .gantt-segment {
            transition: all 0.3s ease;
            height: 2.5rem;
            border-left: 1px solid white;
            position: relative;
            color: white;
            /* Use flex for reliable centering */
            display: flex;
            align-items: center; 
            justify-content: center;
            font-size: 1.125rem; /* text-lg */
        }
        .gantt-time-marker {
            position: absolute;
            top: 2.75rem;
            font-size: 0.75rem;
            color: #4b5563;
        }
        .gantt-time-marker:before {
            content: '';
            position: absolute;
            top: -0.5rem;
            left: 0;
            width: 1px;
            height: 0.5rem;
            background-color: #4b5563;
        }
        /* Sticky header fix */
        .table-sticky-header th {
            position: sticky;
            top: 0;
            background-color: #f3f4f6; /* bg-gray-100 */
            z-index: 10;
        }
        .color-idle { background-color: #e5e7eb; color: #4b5563; }
        #gantt-chart {
            background-color: #f0f0f0; 
            border-radius: 0.5rem;
        }
    `;

    // Handlers
    const handleProcessChange = useCallback((index: number, field: keyof Process, value: string) => {
        const numValue = parseInt(value);
        if ((field === 'burst' || field === 'priority') && numValue <= 0) return;
        if (field === 'arrival' && numValue < 0) return;

        setInputProcesses(prev => prev.map((p, i) => i === index ? { ...p, [field]: numValue } : p));
    }, []);

    const addProcess = useCallback(() => {
        setInputProcesses(prev => {
            const lastP = prev[prev.length - 1];
            const defaultAT = lastP ? lastP.arrival + 1 : 0;
            const defaultP = lastP ? Math.max(1, lastP.priority + 1) : 1;

            const newProcess: Process = {
                id: processCounter,
                pid: `P${processCounter}`,
                arrival: defaultAT,
                burst: 5,
                priority: defaultP,
                remaining: 5,
                completionTime: 0,
                turnaroundTime: 0,
                waitingTime: 0,
                startTimes: []
            };
            setProcessCounter(c => c + 1);
            return [...prev, newProcess];
        });
    }, [processCounter]);

    const removeProcess = useCallback((id: number) => {
        setInputProcesses(prev => prev.filter(p => p.id !== id));
    }, []);

    const handleSubmit = useCallback((e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');

        if (inputProcesses.length === 0) {
            setErrorMessage('Please add at least one process.');
            setGantt([]);
            setMetrics(initialMetrics);
            return;
        }

        const invalidProcess = inputProcesses.find(p =>
            isNaN(p.arrival) || isNaN(p.burst) || isNaN(p.priority) ||
            p.burst <= 0 || p.priority <= 0 || p.arrival < 0
        );

        if (invalidProcess) {
            setErrorMessage(`Error in ${invalidProcess.pid}: All values must be valid positive numbers (Burst and Priority >= 1, Arrival >= 0).`);
            setGantt([]);
            setMetrics(initialMetrics);
            return;
        }

        const sortedProcesses = [...inputProcesses].sort((a, b) => a.arrival - b.arrival);
        const { processes: finishedProcesses, gantt: newGantt, totalTime, idleTime } = runPrioritySimulation(sortedProcesses);

        setResultProcesses(finishedProcesses);
        setGantt(newGantt);

        let totalTAT = 0, totalWT = 0;
        finishedProcesses.forEach(p => {
            totalTAT += p.turnaroundTime;
            totalWT += p.waitingTime;
        });

        const avgTAT = totalTAT / finishedProcesses.length;
        const avgWT = totalWT / finishedProcesses.length;
        // Ensure totalTime is not zero before calculating utilization
        const cpuUtil = totalTime > 0 ? ((totalTime - idleTime) / totalTime) * 100 : 0;

        setMetrics({ avgTAT, avgWT, cpuUtil, totalTime });
    }, [inputProcesses]);

    // Run simulation on load/inputProcesses changes
    React.useEffect(() => {
        // Automatically run simulation with default values
        handleSubmit({ preventDefault: () => {} } as React.FormEvent);
    }, [inputProcesses.length, handleSubmit]);

    // --- Gantt Chart Rendering (RESTORED) ---
    const GanttChart = useMemo(() => {
        if (gantt.length === 0) {
            return <p className="text-gray-500 italic p-4">Run the simulation to generate the Gantt Chart.</p>;
        }
        
        // Define a fixed unit width to control scaling
        const unitWidth = 40; 
        const chartWidth = metrics.totalTime * unitWidth;

        let timeMarkers = [<div key={0} className="gantt-time-marker" style={{ left: '0px' }}>0</div>];
        
        const segments = gantt.map((segment, index) => {
            const duration = segment.end - segment.start;
            const width = duration * unitWidth;
            const colorClass = segment.pid === 'IDLE' ? 'color-idle' : getColorClass(segment.id);
            
            // Add time marker for the end of the segment
            // Check if marker for this time already exists to avoid duplicates
            if (!timeMarkers.some(m => m.key === segment.end.toString())) {
                timeMarkers.push(
                    <div 
                        key={segment.end} 
                        className="gantt-time-marker" 
                        style={{ left: `${segment.end * unitWidth}px` }}
                    >
                        {segment.end}
                    </div>
                );
            }

            return (
                <div
                    key={index}
                    id={`segment-${index}`}
                    className={`gantt-segment ${colorClass} font-bold rounded-md shadow-inner`}
                    style={{ width: `${width}px` }}
                >
                    {segment.pid}
                </div>
            );
        });

        return (
            <div id="gantt-chart-container" className="overflow-x-auto pb-10">
                <div id="gantt-chart" className="flex relative h-16" style={{ width: `${chartWidth}px`, minWidth: '100%' }}>
                    {segments}
                    <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                        {/* Render time markers on top of the chart */}
                        {timeMarkers}
                    </div>
                </div>
            </div>
        );
    }, [gantt, metrics.totalTime]);

    // --- Results Table ---
    const ResultsTable = useMemo(() => {
        const displayedProcesses = [...resultProcesses].sort((a, b) => a.id - b.id);

        return (
            <div className="overflow-x-auto max-h-96">
                <table className="min-w-full divide-y divide-gray-200 border rounded-xl table-fixed shadow-md table-sticky-header">
                    <thead className="bg-gray-100">
                        <tr>
                            {['P ID', 'AT', 'BT', 'Priority', 'CT', 'TAT', 'WT'].map(h => (
                                <th key={h} scope="col" className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider last:rounded-tr-xl first:rounded-tl-xl">
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {displayedProcesses.length === 0 ? (
                            <tr><td colSpan={7} className="p-4 text-center text-gray-500 italic">No results yet.</td></tr>
                        ) : (
                            displayedProcesses.map(p => (
                                <tr key={p.id}>
                                    <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium text-white ${getColorClass(p.id)} shadow-inner rounded-l-lg`}>{p.pid}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{p.arrival}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{p.burst}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold">{p.priority}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold">{p.completionTime || '-'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{p.turnaroundTime || '-'}</td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 rounded-r-lg">{p.waitingTime || '-'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        );
    }, [resultProcesses]);

    // --- Render ---
    return (
        <div className="bg-gray-50 min-h-screen p-4 sm:p-8 font-sans">
            <style>{customStyles}</style>
            <div className="max-w-7xl mx-auto">
                <header className="text-center mb-12">
                    <h1 className="text-5xl font-extrabold text-indigo-700 mb-2">CPU Scheduling Simulator</h1>
                    <p className="text-xl text-gray-600">Preemptive Priority Algorithm</p>
                    <p className="text-sm text-gray-500 mt-2">Lower priority number = Higher priority.</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    {/* Input Panel */}
                    <div className="lg:col-span-1 bg-white p-7 rounded-2xl shadow-xl border border-gray-100 h-fit">
                        <h2 className="text-2xl font-bold mb-4 text-gray-800 border-b pb-2">Process Input</h2>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-4 gap-2 text-sm font-bold text-gray-700 mb-2">
                                <span className="text-center">P ID</span>
                                <span className="text-center">AT</span>
                                <span className="text-center">BT</span>
                                <span className="text-center">P</span>
                            </div>

                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-4">
                                {inputProcesses.map((p, index) => (
                                    <div key={p.id} className="grid grid-cols-4 gap-2 relative items-center group">
                                        <input type="text" value={p.pid} disabled className="p-2 border rounded-lg bg-gray-100 text-center font-semibold" />
                                        <input type="number" min="0" value={p.arrival} onChange={e => handleProcessChange(index, 'arrival', e.target.value)} className="p-2 border rounded-lg text-center focus:ring-indigo-500 focus:border-indigo-500" required />
                                        <input type="number" min="1" value={p.burst} onChange={e => handleProcessChange(index, 'burst', e.target.value)} className="p-2 border rounded-lg text-center focus:ring-indigo-500 focus:border-indigo-500" required />
                                        <input type="number" min="1" value={p.priority} onChange={e => handleProcessChange(index, 'priority', e.target.value)} className="p-2 border rounded-lg text-center font-bold focus:ring-indigo-500 focus:border-indigo-500" required />
                                        <button 
                                            type="button" 
                                            onClick={() => removeProcess(p.id)} 
                                            className="absolute right-[-2rem] top-1/2 -translate-y-1/2 text-red-500 opacity-70 hover:opacity-100 transition duration-200"
                                            title={`Remove ${p.pid}`}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div className="flex flex-col space-y-3 pt-4 border-t">
                                <button type="button" onClick={addProcess} className="flex items-center justify-center space-x-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-xl hover:bg-gray-300 transition shadow-sm text-sm font-medium">
                                    <PlusCircle size={18} />
                                    <span>Add Process</span>
                                </button>
                                <button type="submit" className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition shadow-lg text-lg font-bold w-full">Run Simulation</button>
                            </div>
                        </form>

                        {errorMessage && <p className="text-red-600 bg-red-100 p-3 mt-4 rounded-lg font-medium">{errorMessage}</p>}
                    </div>

                    {/* Output Panels */}
                    <div className="lg:col-span-2 space-y-8">
                        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
                            <h2 className="text-2xl font-bold mb-4 text-gray-800">Summary Metrics</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-indigo-50 rounded-xl text-center shadow-md border-b-4 border-indigo-600">
                                    <p className="text-4xl font-extrabold text-indigo-700">{metrics.avgTAT.toFixed(2)}</p>
                                    <p className="text-sm text-gray-600 mt-1">Avg. Turnaround Time</p>
                                </div>
                                <div className="p-4 bg-purple-50 rounded-xl text-center shadow-md border-b-4 border-purple-600">
                                    <p className="text-4xl font-extrabold text-purple-700">{metrics.avgWT.toFixed(2)}</p>
                                    <p className="text-sm text-gray-600 mt-1">Avg. Waiting Time</p>
                                </div>
                                <div className="p-4 bg-emerald-50 rounded-xl text-center shadow-md border-b-4 border-emerald-600">
                                    <p className="text-4xl font-extrabold text-emerald-700">{metrics.cpuUtil.toFixed(2)}%</p>
                                    <p className="text-sm text-gray-600 mt-1">CPU Utilization</p>
                                </div>
                                <div className="p-4 bg-gray-100 rounded-xl text-center shadow-md border-b-4 border-gray-400">
                                    <p className="text-4xl font-extrabold text-gray-700">{metrics.totalTime}</p>
                                    <p className="text-sm text-gray-600 mt-1">Total Execution Time</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
                            <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-2">Gantt Chart</h2>
                            {GanttChart}
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100">
                            <h2 className="text-2xl font-bold mb-4 text-gray-800">Process Metrics</h2>
                            {ResultsTable}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}