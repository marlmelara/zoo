import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../lib/api';
import { getSuppliesByDepartment, createSupplyRequest, getMySupplyRequests } from '../../../api/supplies';
import { logActivity } from '../../../api/activityLog';
import { useToast } from '../../../components/Feedback';
import {
    EmployeeSuppliesPanel, EmployeeRequestsPanel, EmployeeEventsPanel,
} from '../../../components/EmployeeDashboardPanels';
import AnimalMedicalPanel from '../../../components/AnimalMedicalPanel';
import { setHealthStatus } from '../../../api/animals';
import { Cat, Activity, Heart } from 'lucide-react';

const TABS = ['My Animals', 'Medical Records', 'My Events', 'Supplies', 'My Requests'];

export default function VetDashboard() {
    const { user, employeeId, deptId } = useAuth();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState('My Animals');

    // Resolved IDs
    const [resolvedEmpId, setResolvedEmpId] = useState(employeeId);
    const [resolvedDeptId, setResolvedDeptId] = useState(deptId);

    // Animals state
    const [animals, setAnimals] = useState([]);
    const [animalsLoading, setAnimalsLoading] = useState(true);

    // Medical records — actual history management lives inside the
    // shared AnimalMedicalPanel so vets, managers, and admins all see the
    // same form (diagnosis / severity / status / treatment / vitals / etc).
    const [selectedAnimal, setSelectedAnimal] = useState(null);

    // Supplies state
    const [supplies, setSupplies] = useState([]);
    const [suppliesLoading, setSuppliesLoading] = useState(true);
    const [myRequests, setMyRequests] = useState([]);
    const [showRequestForm, setShowRequestForm] = useState(false);
    const [requestForm, setRequestForm] = useState({ supply_id: '', quantity: '', reason: '' });

    // Events state
    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(true);

    useEffect(() => {
        async function loadDashboard() {
            if (!user?.userId) return;

            let empId = employeeId;
            let depId = deptId;

            if (!empId || !depId) {
                try {
                    const data = await api.get('/employees/me');
                    empId = data.employee_id;
                    depId = data.dept_id;
                    setResolvedEmpId(empId);
                    setResolvedDeptId(depId);
                } catch (err) {
                    console.error('Error resolving employee:', err);
                }
            } else {
                setResolvedEmpId(empId);
                setResolvedDeptId(depId);
            }

            fetchMyAnimals(empId);
            fetchMyEvents(empId);
            if (depId) {
                fetchSupplies(depId);
                fetchMyRequests(empId);
            } else {
                setSuppliesLoading(false);
            }
        }
        loadDashboard();
    }, [user?.userId, employeeId, deptId]);

    async function fetchMyAnimals(empId) {
        if (!empId && !resolvedEmpId && !employeeId) { setAnimalsLoading(false); return; }
        try {
            const data = await api.get('/animals/assigned/vet');
            setAnimals(data || []);
        } catch (err) {
            console.error('Error fetching vet animals:', err);
            setAnimals([]);
        } finally {
            setAnimalsLoading(false);
        }
    }

    async function fetchSupplies(depId) {
        const id = depId || resolvedDeptId || deptId;
        if (!id) { setSuppliesLoading(false); return; }
        try {
            const data = await getSuppliesByDepartment(id);
            setSupplies(data);
        } catch (err) {
            console.error('Error fetching supplies:', err);
        } finally {
            setSuppliesLoading(false);
        }
    }

    async function fetchMyRequests(empId) {
        const id = empId || resolvedEmpId || employeeId;
        if (!id) return;
        try {
            const data = await getMySupplyRequests(id);
            setMyRequests(data);
        } catch (err) {
            console.error('Error fetching my requests:', err);
        }
    }

    async function handleRequestSubmit(e) {
        e.preventDefault();
        const supply = supplies.find(s => s.supply_id === parseInt(requestForm.supply_id));
        const empId = resolvedEmpId || employeeId;
        if (!supply || !empId) return;
        const action = requestForm.action === 'remove' ? 'remove' : 'restock';
        try {
            const newRequest = await createSupplyRequest({
                requested_by: empId,
                supply_type: 'operational',
                action,
                item_id: supply.supply_id,
                item_name: supply.item_name,
                requested_quantity: parseInt(requestForm.quantity),
                reason: requestForm.reason
            });
            await logActivity({
                action_type: 'supply_request_created',
                description: `Requested ${action === 'remove' ? 'removal of ' : ''}${requestForm.quantity}x ${supply.item_name}`,
                performed_by: empId,
                target_type: 'supply_request',
                target_id: newRequest.request_id,
                metadata: { item_name: supply.item_name, quantity: parseInt(requestForm.quantity), reason: requestForm.reason, action }
            });
            setShowRequestForm(false);
            setRequestForm({ supply_id: '', quantity: '', reason: '', action: 'restock' });
            fetchMyRequests(empId);
        } catch (err) {
            console.error('Error creating supply request:', err);
            toast.error('Failed to submit request: ' + err.message);
        }
    }

    async function fetchMyEvents(empId) {
        if (!empId && !resolvedEmpId && !employeeId) { setEventsLoading(false); return; }
        try {
            const data = await api.get('/events/assigned');
            // Show earliest first — this view is about what's next on my plate.
            const sorted = (data || []).slice().sort(
                (a, b) => a.event_date.localeCompare(b.event_date)
            );
            setEvents(sorted);
        } catch (err) {
            console.error('Error fetching events:', err);
        } finally {
            setEventsLoading(false);
        }
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ margin: 0 }}>Veterinarian Dashboard</h1>
                    <p style={{ color: 'var(--color-text-muted)', margin: '5px 0 0' }}>Animal Health & Medical Management</p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
                {TABS.map(tab => (
                    <button
                        key={tab}
                        className="glass-button"
                        onClick={() => setActiveTab(tab)}
                        style={{
                            background: activeTab === tab ? 'var(--color-primary)' : 'rgba(255, 245, 231, 0.65)',
                            color: activeTab === tab ? 'white' : 'rgb(102, 122, 66)',
                            padding: '10px 20px',
                            fontSize: '14px',
                            fontWeight: activeTab === tab ? 700 : 500
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* ═══════════ MY ANIMALS TAB ═══════════ */}
            {activeTab === 'My Animals' && (
                <div>
                    {animalsLoading ? <p>Loading animals...</p> : animals.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                            <Cat size={48} style={{ marginBottom: '15px', opacity: 0.3 }} />
                            <p>No animals currently assigned to you.</p>
                        </div>
                    ) : (
                        <div className="grid-cards">
                            {animals.map(animal => (
                                <div key={animal.animal_id} className="glass-panel" style={{ padding: '20px' }}>
                                    <h3 style={{ margin: '0 0 10px' }}>{animal.name}</h3>
                                    <p style={{ color: 'var(--color-primary)', fontSize: '14px', marginBottom: '15px' }}>
                                        {animal.species_common_name}
                                    </p>
                                    <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
                                        <p>Age: {animal.age} years</p>
                                        <p>Zone: {animal.zone_name || 'Unassigned'}</p>
                                    </div>

                                    {/* Health-status flag — vets can downgrade/upgrade their
                                        assigned animals. Flipping into sick/critical fires
                                        trg_animal_sick_notify, which pages every vet,
                                        caretaker, vet/animal-care manager, and admin. */}
                                    <div style={{ marginBottom: '12px' }}>
                                        <label style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em',
                                            textTransform: 'uppercase',
                                            color: 'rgb(102, 122, 66)', marginBottom: '4px',
                                        }}>
                                            <Heart size={12} /> Health status
                                        </label>
                                        <select
                                            className="glass-input"
                                            defaultValue={animal.health_status || 'healthy'}
                                            onChange={async (e) => {
                                                try {
                                                    await setHealthStatus(animal.animal_id, e.target.value);
                                                    toast.success(`Marked ${animal.name} as ${e.target.value.replace('_', ' ')}.`);
                                                    fetchMyAnimals(resolvedEmpId || employeeId);
                                                } catch (err) {
                                                    toast.error('Failed to update: ' + err.message);
                                                }
                                            }}
                                            style={{ fontSize: '13px', padding: '6px 8px' }}
                                        >
                                            <option value="healthy">Healthy</option>
                                            <option value="under_observation">Under observation</option>
                                            <option value="recovering">Recovering</option>
                                            <option value="sick">Sick</option>
                                            <option value="critical">Critical</option>
                                        </select>
                                    </div>

                                    <button
                                        className="glass-button"
                                        style={{ width: '100%', fontSize: '12px', padding: '8px' }}
                                        onClick={() => {
                                            setSelectedAnimal(animal);
                                            setActiveTab('Medical Records');
                                        }}
                                    >
                                        <Activity size={14} style={{ marginRight: '5px' }} />
                                        View Medical Records
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ MEDICAL RECORDS TAB ═══════════ */}
            {activeTab === 'Medical Records' && (
                <div>
                    {!selectedAnimal ? (
                        <div>
                            <p style={{ color: 'var(--color-text-muted)', marginBottom: '20px' }}>Select an animal to view their medical records.</p>
                            <div className="grid-cards">
                                {animals.map(animal => (
                                    <div
                                        key={animal.animal_id}
                                        className="glass-panel"
                                        style={{ padding: '20px', cursor: 'pointer', transition: 'transform 0.2s' }}
                                        onClick={() => setSelectedAnimal(animal)}
                                    >
                                        <h3 style={{ margin: '0 0 5px' }}>{animal.name}</h3>
                                        <p style={{ color: 'var(--color-text-muted)', fontSize: '14px' }}>{animal.species_common_name}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                                <button
                                    className="glass-button"
                                    onClick={() => setSelectedAnimal(null)}
                                    style={{ padding: '8px 12px' }}
                                >
                                    Back
                                </button>
                                <Activity color="var(--color-accent)" />
                                <h2 style={{ margin: 0 }}>Medical Records: {selectedAnimal.name}</h2>
                            </div>
                            {/* Vets can modify medical records on their assigned animals
                                (the VetDashboard only lists assigned animals in the first
                                place), but care logs are caretakers' domain — they can
                                view the history but not add entries. */}
                            <AnimalMedicalPanel
                                animalId={selectedAnimal.animal_id}
                                canFileMedical={true}
                                canFileCare={false}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════ SUPPLIES TAB ═══════════ */}
            {activeTab === 'Supplies' && (
                <EmployeeSuppliesPanel
                    title="Medical Supplies"
                    supplies={supplies}
                    suppliesLoading={suppliesLoading}
                    showRequestForm={showRequestForm}
                    setShowRequestForm={setShowRequestForm}
                    requestForm={requestForm}
                    setRequestForm={setRequestForm}
                    onSubmitRequest={handleRequestSubmit}
                    emptyLabel="No medical supplies assigned to your department."
                />
            )}

            {/* ═══════════ MY REQUESTS TAB ═══════════ */}
            {activeTab === 'My Requests' && (
                <EmployeeRequestsPanel myRequests={myRequests} loading={suppliesLoading} />
            )}

            {/* ═══════════ MY EVENTS TAB ═══════════ */}
            {activeTab === 'My Events' && (
                <EmployeeEventsPanel events={events} loading={eventsLoading} accentColor="var(--color-primary)" />
            )}
        </div>
    );
}
