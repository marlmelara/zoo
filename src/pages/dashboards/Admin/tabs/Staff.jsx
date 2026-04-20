import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../../../../lib/api';
import { useAuth } from '../../../../contexts/AuthContext';
import { User, Stethoscope, Briefcase, Shield, Trash2, PawPrint, ShoppingBag, X } from 'lucide-react';
import { StatusFilter } from '../../../../components/AnimalsPanel';
import BulkActionBar from '../../../../components/BulkActionBar';
import LifecycleLogModal, { LifecycleLogButton } from '../../../../components/LifecycleLogModal';
import { useToast, useConfirm } from '../../../../components/Feedback';
import { formatShiftTimeframe, defaultOfficeFor } from '../../../../utils/staff';
import { ROLE_DEPT_MAP } from '../../../../api/dashboard';

const GREEN      = 'rgb(123, 144, 79)';
const GREEN_DARK = 'rgb(102, 122, 66)';

export default function Staff() {
    const { role } = useAuth();
    const toast   = useToast();
    const confirm = useConfirm();
    const canManage = role === 'admin';
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [statusFilter, setStatusFilter] = useState('active');
    const [deptFilter, setDeptFilter]     = useState('all');
    const [manageMode, setManageMode] = useState(false);
    const [selected, setSelected] = useState(() => new Set());
    const [editing, setEditing] = useState(null);
    const [editForm, setEditForm] = useState({});
    // Lifecycle log modal — viewing activation/deactivation history for
    // one staff member at a time.
    const [logTarget, setLogTarget] = useState(null);
    const emptyFormData = {
        first_name: '', last_name: '', contact_info: '', pay_rate_cents: '',
        shift_start: '09:00', shift_end: '17:00',
        date_of_birth: '',
        dept_id: '',
        email: '', password: '', role: '',
        license_no: '', specialty: '',
        specialization_species: '',
        office_location: '',
        manager_id: '',
    };
    const [formData, setFormData] = useState(emptyFormData);
    const [confirmPassword, setConfirmPassword] = useState('');
    // Supervisor picker state — dept managers for regular staff, admins
    // for managers. We populate whichever list is relevant and the UI
    // renders one dropdown either way.
    const [deptManagers, setDeptManagers] = useState([]);
    const [adminsList, setAdminsList]     = useState([]);

    useEffect(() => {
        fetchStaff();
        fetchDepartments();
    }, [statusFilter]);

    // Load dept managers (for non-manager, non-admin roles) whenever
    // dept/role change. Covers both the Add form and the Edit modal.
    useEffect(() => {
        const addActive  = showForm && formData.dept_id
            && formData.role !== 'admin' && formData.role !== 'manager';
        const editActive = !!editing && editForm.dept_id
            && editForm.role !== 'admin' && editForm.role !== 'manager';
        const deptId = addActive ? formData.dept_id : editActive ? editForm.dept_id : '';
        if (!deptId) { setDeptManagers([]); return; }
        api.get(`/employees/managers?dept_id=${deptId}`)
            .then(setDeptManagers)
            .catch(() => setDeptManagers([]));
    }, [showForm, formData.dept_id, formData.role,
        editing, editForm.dept_id, editForm.role]);

    // Load admins lazily when a manager is being created or edited —
    // managers report to an admin. Cached after the first load.
    useEffect(() => {
        const needsAdmins = (showForm && formData.role === 'manager')
                          || (editing && editForm.role === 'manager');
        if (!needsAdmins) return;
        if (adminsList.length > 0) return;
        api.get('/employees/admins')
            .then(setAdminsList)
            .catch(() => setAdminsList([]));
    }, [showForm, formData.role, editing, editForm.role, adminsList.length]);

    async function fetchStaff() {
        setLoading(true);
        try {
            const data = await api.get(`/employees?status=${statusFilter}`);
            setStaff(data || []);
        } catch (error) {
            console.error('Error fetching staff:', error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchDepartments() {
        const data = await api.get('/employees/departments/all');
        if (data) setDepartments(data);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (formData.password !== confirmPassword) {
            toast.warn('Passwords do not match. Please re-enter.');
            return;
        }
        // Compose the shift string from the two pickers so we never end up
        // with free-text garbage like "8-4" going into shift_timeframe.
        if (formData.shift_start && formData.shift_end
            && formData.shift_start >= formData.shift_end) {
            toast.warn('Shift end time must be after the start time.');
            return;
        }
        const role = formData.role;
        if (role !== 'admin' && !formData.manager_id) {
            toast.warn(role === 'manager'
                ? 'Pick a supervising admin for this manager.'
                : 'Pick a supervising manager for this employee.');
            return;
        }
        try {
            await api.post('/employees', {
                first_name: formData.first_name,
                last_name: formData.last_name,
                contact_info: formData.contact_info || formData.email,
                date_of_birth: formData.date_of_birth || null,
                pay_rate_cents: formData.pay_rate_cents
                    ? Math.round(parseFloat(formData.pay_rate_cents) * 100)
                    : 2000,
                shift_timeframe: formData.shift_start && formData.shift_end
                    ? `${formData.shift_start}-${formData.shift_end}`
                    : null,
                dept_id: formData.dept_id,
                email: formData.email,
                password: formData.password,
                role,
                license_no: formData.license_no || null,
                specialty: formData.specialty || null,
                specialization_species: formData.specialization_species || null,
                office_location: formData.office_location || null,
                manager_id: role === 'admin' ? null : parseInt(formData.manager_id),
            });

            closeForm();
            fetchStaff();
        } catch (error) {
            console.error('Error adding staff:', error);
            toast.error('Failed to add staff: ' + error.message);
        }
    }

    function closeForm() {
        setShowForm(false);
        setFormData(emptyFormData);
        setConfirmPassword('');
    }

    function toggleSelect(id) {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }

    function selectAllVisible() {
        setSelected(new Set(filteredStaff.filter(p => p.is_active).map(p => p.employee_id)));
    }

    function exitManageMode() {
        setManageMode(false);
        setSelected(new Set());
    }

    function startEdit(person) {
        // Split an existing "HH:MM-HH:MM" into two time inputs. If the
        // stored value is malformed (older free-text rows), fall back to
        // reasonable defaults and let the user correct.
        const [startRaw, endRaw] = (person.shift_timeframe || '').split('-');
        const toHHMM = (s) => {
            if (!s) return '';
            const m = s.trim().match(/^(\d{1,2}):?(\d{2})?/);
            if (!m) return '';
            const hh = m[1].padStart(2, '0');
            const mm = (m[2] || '00').padStart(2, '0');
            return `${hh}:${mm}`;
        };
        setEditing(person);
        setEditForm({
            first_name: person.first_name || '',
            last_name: person.last_name || '',
            contact_info: person.contact_info || '',
            shift_start: toHHMM(startRaw) || '09:00',
            shift_end:   toHHMM(endRaw)   || '17:00',
            date_of_birth: person.date_of_birth ? String(person.date_of_birth).slice(0, 10) : '',
            pay_rate: person.pay_rate_cents != null ? (person.pay_rate_cents / 100).toFixed(2) : '',
            dept_id: person.dept_id != null ? String(person.dept_id) : '',
            role:    person.role || '',
            manager_id: person.manager_id != null ? String(person.manager_id) : '',
            license_no:              person.license_no || '',
            specialty:               person.specialty || '',
            specialization_species:  person.specialization_species || '',
            office_location:         person.office_location || '',
        });
    }
    function cancelEdit() { setEditing(null); setEditForm({}); }
    async function handleEditSave(e) {
        e.preventDefault();
        if (!editing) return;
        if (editForm.shift_start && editForm.shift_end
            && editForm.shift_start >= editForm.shift_end) {
            toast.warn('Shift end time must be after the start time.');
            return;
        }
        const role = editForm.role;
        if (role && role !== 'admin' && !editForm.manager_id) {
            toast.warn(role === 'manager'
                ? 'Pick a supervising admin for this manager.'
                : 'Pick a supervising manager for this employee.');
            return;
        }
        try {
            const payload = {
                first_name: editForm.first_name,
                last_name: editForm.last_name,
                contact_info: editForm.contact_info || null,
                date_of_birth: editForm.date_of_birth || null,
                shift_timeframe: editForm.shift_start && editForm.shift_end
                    ? `${editForm.shift_start}-${editForm.shift_end}`
                    : null,
                pay_rate_cents: editForm.pay_rate === '' ? null : Math.round(parseFloat(editForm.pay_rate) * 100),
                dept_id: editForm.dept_id === '' ? null : parseInt(editForm.dept_id),
                manager_id: role === 'admin'
                    ? null
                    : (editForm.manager_id ? parseInt(editForm.manager_id) : null),
            };
            // Role-specific fields — only include what's applicable so the
            // backend doesn't try to stamp, say, a license_no onto a retail
            // clerk. Vet-dept managers keep their vet row, so they also
            // get the vet fields.
            if (role === 'vet' || role === 'manager') {
                if (editForm.license_no !== undefined) payload.license_no = editForm.license_no || null;
                if (editForm.specialty  !== undefined) payload.specialty  = editForm.specialty || null;
            }
            if (role === 'caretaker' && editForm.specialization_species !== undefined) {
                payload.specialization_species = editForm.specialization_species || null;
            }
            if (role === 'manager' && editForm.office_location !== undefined) {
                payload.office_location = editForm.office_location || null;
            }
            await api.patch(`/employees/${editing.employee_id}`, payload);
            cancelEdit();
            fetchStaff();
        } catch (err) {
            toast.error('Failed to save: ' + err.message);
        }
    }

    async function handleRemoveSelected() {
        if (selected.size === 0) return;
        const ok = await confirm({
            title: `Deactivate ${selected.size} staff member${selected.size === 1 ? '' : 's'}?`,
            message: 'They can be reactivated later from the Reactivate tab.',
            confirmLabel: 'Deactivate',
            tone: 'danger',
        });
        if (!ok) return;
        const ids = Array.from(selected);
        const results = await Promise.allSettled(ids.map(id => api.delete(`/employees/${id}`)));
        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length) {
            toast.error(`${failed.length} deactivation${failed.length === 1 ? '' : 's'} failed.`);
        } else {
            toast.success(`Deactivated ${ids.length} staff member${ids.length === 1 ? '' : 's'}.`);
        }
        exitManageMode();
        fetchStaff();
    }

    const getRoleIcon = (deptName) => {
        switch (deptName) {
            case 'Veterinary Services': return <Stethoscope size={20} color="var(--color-primary)" />;
            case 'Animal Care':         return <PawPrint size={20} color="rgb(123, 144, 79)" />;
            case 'Administration':      return <Briefcase size={20} color="var(--color-secondary)" />;
            case 'Security':            return <Shield size={20} color="var(--color-accent)" />;
            case 'Retail & Operations': return <ShoppingBag size={20} color="#c2410c" />;
            default: return <User size={20} color="var(--color-text-muted)" />;
        }
    };

    const [searchTerm, setSearchTerm] = useState('');

    // Lookup for rendering each card's supervisor line. Filter runs *after*
    // this map is built so we never lose a supervisor just because they're
    // filtered out of view.
    const staffById = new Map(staff.map(p => [p.employee_id, p]));

    const filteredStaff = staff
        .filter(person => {
            const q = searchTerm.toLowerCase();
            const matchesSearch =
                person.first_name.toLowerCase().includes(q) ||
                person.last_name.toLowerCase().includes(q) ||
                (person.dept_name || '').toLowerCase().includes(q);
            const matchesDept =
                deptFilter === 'all' || String(person.dept_id) === String(deptFilter);
            return matchesSearch && matchesDept;
        })
        .sort((a, b) => {
            // Three tiers: admin → manager → everyone else. Admins don't
            // belong to any one dept in ranking terms, so they just sort
            // alphabetically among themselves. Managers + regular staff
            // sort by department alphabetically first, then by name.
            const tier = (p) =>
                p.role === 'admin'   ? 0
              : p.role === 'manager' ? 1
              :                        2;
            const ta = tier(a), tb = tier(b);
            if (ta !== tb) return ta - tb;
            if (ta > 0) {
                const deptCmp = (a.dept_name || '').localeCompare(b.dept_name || '');
                if (deptCmp !== 0) return deptCmp;
            }
            const lastCmp = (a.last_name || '').localeCompare(b.last_name || '');
            return lastCmp !== 0 ? lastCmp : (a.first_name || '').localeCompare(b.first_name || '');
        });

    const STATUS_TABS = [
        { key: 'active',   label: 'Active' },
        { key: 'inactive', label: 'Inactive' },
        { key: 'all',      label: 'All' },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '14px' }}>
                <h1 style={{ margin: 0 }}>Staff Management</h1>
                {(role === 'admin' || role === 'manager') && (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            className="glass-button"
                            onClick={() => showForm ? closeForm() : setShowForm(true)}
                            style={{ background: 'rgba(255,255,255,0.1)' }}
                        >
                            + Add Staff
                        </button>
                        {canManage && (
                            manageMode ? (
                                <button className="glass-button" onClick={exitManageMode}
                                    style={{ background: 'rgba(239,68,68,0.18)', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                                    × Exit Removal
                                </button>
                            ) : (
                                <button className="glass-button" onClick={() => setManageMode(true)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Trash2 size={14} /> Manage Staff
                                </button>
                            )
                        )}
                    </div>
                )}
            </div>

            {/* Search sits below the heading to match Animals + Manager
                panels — same pattern across every list view. */}
            <input
                type="text"
                placeholder="Search by name or department..."
                className="glass-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ maxWidth: '440px', marginBottom: '14px', display: 'block' }}
            />

            <div style={{ marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <StatusFilter
                    label="Status"
                    tabs={STATUS_TABS}
                    value={statusFilter}
                    onChange={setStatusFilter}
                />
                <StatusFilter
                    label="Dept"
                    tabs={[
                        { key: 'all', label: 'All' },
                        ...departments.map(d => ({ key: String(d.dept_id), label: d.dept_name })),
                    ]}
                    value={deptFilter}
                    onChange={setDeptFilter}
                />
            </div>

            {showForm && createPortal((() => {
                const role = formData.role;
                const isVet       = role === 'vet';
                const isCaretaker = role === 'caretaker';
                const isManager   = role === 'manager';
                const selectedDeptName = (departments.find(d => String(d.dept_id) === String(formData.dept_id)) || {}).dept_name || '';
                const isVetManager = isManager && /veterinary/i.test(selectedDeptName);
                const needsSupervisor = role && role !== 'admin';
                // Dept is auto-set for every role except manager and the
                // empty placeholder, so lock the dropdown when it's implicit.
                const isDeptAutoSet = role !== '' && role !== 'manager';
                const pickRole = (nextRole) => {
                    // Auto-match the department from ROLE_DEPT_MAP so admins
                    // don't have to pick it manually for every role.
                    // Managers also default to the lowest-numbered admin
                    // as their supervisor (current policy: managers report
                    // to Zoo Admin).
                    const deptName = ROLE_DEPT_MAP[nextRole];
                    const matchedDept = departments.find(d => d.dept_name === deptName);
                    const nextDeptId = matchedDept ? String(matchedDept.dept_id) : '';
                    const nextDeptName = matchedDept ? matchedDept.dept_name : '';
                    const defaultAdminId = (adminsList[0] && adminsList[0].employee_id) || '';
                    setFormData({
                        ...formData,
                        role: nextRole,
                        dept_id: nextDeptId,
                        manager_id: nextRole === 'manager' ? String(defaultAdminId) : '',
                        license_no: '',
                        specialty: '',
                        specialization_species: '',
                        office_location: defaultOfficeFor(nextRole, nextDeptName),
                    });
                };
                const pickDept = (nextDeptId) => {
                    const nextName = (departments.find(d => String(d.dept_id) === String(nextDeptId)) || {}).dept_name || '';
                    setFormData({
                        ...formData,
                        dept_id: nextDeptId,
                        manager_id: '',
                        office_location: defaultOfficeFor(role, nextName),
                    });
                };
                return (
                <div onClick={closeForm} style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px',
                }}>
                    <div onClick={e => e.stopPropagation()} style={{
                        width: '560px', maxWidth: '92vw', maxHeight: '92vh', overflowY: 'auto',
                        padding: '28px', background: 'rgba(255,255,255,0.96)', color: 'var(--color-text-dark)',
                        border: `1px solid ${GREEN}`, borderRadius: '14px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                            <h2 style={{ margin: 0, color: GREEN_DARK }}>Create New User</h2>
                            <button onClick={closeForm} style={{ background: 'none', border: 'none', color: GREEN_DARK, cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                                <label style={staffLabelStyle}>First Name</label>
                                <input required className="glass-input" value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} />
                            </div>
                            <div>
                                <label style={staffLabelStyle}>Last Name</label>
                                <input required className="glass-input" value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={staffLabelStyle}>Email</label>
                                <input required type="email" className="glass-input" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                            <div>
                                <label style={staffLabelStyle}>Password</label>
                                <input required type="password" className="glass-input" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                            </div>
                            <div>
                                <label style={staffLabelStyle}>Confirm Password</label>
                                <input required type="password" className="glass-input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={staffLabelStyle}>Role</label>
                                <select required className="glass-input" value={formData.role} onChange={e => pickRole(e.target.value)}>
                                    <option value="" disabled>Select Role...</option>
                                    <option value="security">Security</option>
                                    <option value="retail">Retail</option>
                                    <option value="caretaker">Caretaker</option>
                                    <option value="vet">Vet</option>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={staffLabelStyle}>Department</label>
                                <select required className="glass-input"
                                    style={{ opacity: isDeptAutoSet ? 0.6 : 1 }}
                                    value={formData.dept_id}
                                    onChange={e => pickDept(e.target.value)}
                                    disabled={isDeptAutoSet}>
                                    <option value="">Select Department...</option>
                                    {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
                                </select>
                            </div>

                            {/* Structured shift pickers — no more free-text garbage. */}
                            <div>
                                <label style={staffLabelStyle}>Shift Start</label>
                                <input type="time" required className="glass-input"
                                    value={formData.shift_start}
                                    onChange={e => setFormData({ ...formData, shift_start: e.target.value })} />
                            </div>
                            <div>
                                <label style={staffLabelStyle}>Shift End</label>
                                <input type="time" required className="glass-input"
                                    value={formData.shift_end}
                                    onChange={e => setFormData({ ...formData, shift_end: e.target.value })} />
                            </div>

                            <div>
                                <label style={staffLabelStyle}>Hourly Rate ($)</label>
                                <input required type="number" step="0.01" min="0" className="glass-input"
                                    placeholder="20.00"
                                    value={formData.pay_rate_cents}
                                    onChange={e => setFormData({ ...formData, pay_rate_cents: e.target.value })} />
                            </div>
                            <div>
                                <label style={staffLabelStyle}>Contact (phone / ext.)</label>
                                <input className="glass-input" placeholder="Defaults to email"
                                    value={formData.contact_info}
                                    onChange={e => setFormData({ ...formData, contact_info: e.target.value })} />
                            </div>

                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={staffLabelStyle}>Date of Birth</label>
                                <input required type="date" className="glass-input"
                                    max={new Date().toISOString().slice(0, 10)}
                                    value={formData.date_of_birth}
                                    onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })} />
                            </div>

                            {needsSupervisor && (() => {
                                const options = isManager ? adminsList : deptManagers;
                                const emptyHint = isManager
                                    ? 'No admins on record yet — create an admin first.'
                                    : 'No managers in this department yet — create a manager first.';
                                const label = isManager ? 'Supervisor (admin)' : 'Supervisor (manager in this dept)';
                                return (
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={staffLabelStyle}>{label}</label>
                                        <select required className="glass-input"
                                            value={formData.manager_id}
                                            onChange={e => setFormData({ ...formData, manager_id: e.target.value })}>
                                            <option value="" disabled>
                                                {options.length === 0 ? emptyHint : 'Select supervisor...'}
                                            </option>
                                            {options.map(m => (
                                                <option key={m.employee_id} value={m.employee_id}>
                                                    {m.first_name} {m.last_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })()}

                            {(isVet || isVetManager) && (<>
                                <div>
                                    <label style={staffLabelStyle}>Vet License #</label>
                                    <input required className="glass-input" value={formData.license_no} onChange={e => setFormData({ ...formData, license_no: e.target.value })} />
                                </div>
                                <div>
                                    <label style={staffLabelStyle}>Specialty</label>
                                    <input required className="glass-input" placeholder="Large mammals, reptiles, …" value={formData.specialty} onChange={e => setFormData({ ...formData, specialty: e.target.value })} />
                                </div>
                            </>)}
                            {isCaretaker && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={staffLabelStyle}>Specialization (species)</label>
                                    <input required className="glass-input" placeholder="Primates, penguins, …" value={formData.specialization_species} onChange={e => setFormData({ ...formData, specialization_species: e.target.value })} />
                                </div>
                            )}
                            {role && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={staffLabelStyle}>
                                        Office Location {isManager ? '(dept + Head Office)' : ''}
                                    </label>
                                    <input required className="glass-input"
                                        value={formData.office_location}
                                        onChange={e => setFormData({ ...formData, office_location: e.target.value })} />
                                </div>
                            )}

                            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', marginTop: '6px' }}>
                                <button type="button" onClick={closeForm} className="glass-button" style={{ flex: 1 }}>Cancel</button>
                                <button type="submit" className="glass-button" style={{ flex: 2, background: GREEN, color: 'white', fontWeight: 700 }}>Create Account</button>
                            </div>
                        </form>
                    </div>
                </div>
                );
            })(), document.body)}

            {loading ? (
                <p>Loading staff...</p>
            ) : filteredStaff.length === 0 ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <p>No {statusFilter === 'all' ? '' : statusFilter} staff to display.</p>
                </div>
            ) : (
                <div className="grid-cards" style={{ paddingBottom: manageMode ? '90px' : 0 }}>
                    {filteredStaff.map(person => {
                        const inactive = person.is_active === 0;
                        const selectable = manageMode && !inactive;
                        const checked = selected.has(person.employee_id);
                        // Click anywhere on the card to edit (matches Events).
                        // In manage mode, clicks toggle selection instead.
                        const canEditCard = canManage && !manageMode && !inactive;
                        const handleCardClick = () => {
                            if (selectable) toggleSelect(person.employee_id);
                            else if (canEditCard) startEdit(person);
                        };
                        // Role → pill colour so the manager/admin stands out
                        // at a glance when filtered by department.
                        const roleColor = person.role === 'admin'      ? { bg: 'rgba(168,85,247,0.18)', fg: '#7e22ce' }
                                        : person.role === 'manager'    ? { bg: 'rgba(234,179,8,0.18)',  fg: '#a16207' }
                                        : person.role === 'vet'        ? { bg: 'rgba(16,185,129,0.18)', fg: '#047857' }
                                        : person.role === 'caretaker'  ? { bg: 'rgba(59,130,246,0.18)', fg: '#1d4ed8' }
                                        : person.role === 'security'   ? { bg: 'rgba(239,68,68,0.18)',  fg: '#b91c1c' }
                                        :                                { bg: 'rgba(121,162,128,0.18)', fg: 'rgb(102,122,66)' };
                        return (
                            <div
                                key={person.employee_id}
                                className="glass-panel"
                                onClick={handleCardClick}
                                style={{
                                    padding: '20px',
                                    // Room at the bottom for the absolutely-positioned
                                    // Log button so it never overlaps content.
                                    paddingBottom: canManage ? '56px' : '20px',
                                    position: 'relative',
                                    minHeight: '230px',
                                    opacity: inactive ? 0.55 : 1,
                                    cursor: (selectable || canEditCard) ? 'pointer' : 'default',
                                    outline: checked ? '2px solid #ef4444' : 'none',
                                    transition: 'outline 120ms, transform 150ms',
                                }}
                                onMouseEnter={e => { if (canEditCard) e.currentTarget.style.transform = 'translateY(-2px)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                            >
                                {manageMode && !inactive && (
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleSelect(person.employee_id)}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ position: 'absolute', top: '12px', left: '12px', width: '18px', height: '18px', accentColor: '#ef4444', zIndex: 2 }}
                                    />
                                )}
                                {inactive && (
                                    <span style={{
                                        position: 'absolute', top: '12px', right: '14px',
                                        fontSize: '10px', padding: '3px 10px', borderRadius: '12px',
                                        background: 'rgba(239,68,68,0.18)', color: '#b91c1c', fontWeight: 700, textTransform: 'uppercase',
                                        letterSpacing: '0.06em', zIndex: 2,
                                    }}>Inactive</span>
                                )}
                                <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'start',
                                    marginBottom: '15px',
                                    paddingLeft: manageMode && !inactive ? '28px' : 0,
                                    paddingRight: inactive ? '80px' : '0',
                                    transition: 'padding 150ms',
                                    gap: '10px',
                                }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 6px' }}>{person.first_name} {person.last_name}</h3>
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            <span style={{
                                                fontSize: '11px', padding: '3px 10px', borderRadius: '20px',
                                                background: roleColor.bg, color: roleColor.fg,
                                                fontWeight: 700, textTransform: 'capitalize',
                                            }}>{person.role || 'staff'}</span>
                                            <span style={{
                                                fontSize: '12px',
                                                padding: '4px 8px',
                                                borderRadius: '20px',
                                                background: 'rgba(255,255,255,0.1)',
                                                color: 'var(--color-text-muted)'
                                            }}>
                                                {person.dept_name || 'Unassigned'}
                                            </span>
                                        </div>
                                    </div>
                                    {!inactive && getRoleIcon(person.dept_name)}
                                </div>

                                <div style={{ fontSize: '14px', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    <p style={{ margin: 0 }}>Shift: {formatShiftTimeframe(person.shift_timeframe) || 'N/A'}</p>
                                    {/* Vet license shows for real vets AND for vet-dept
                                        managers — the JOIN fills license_no/specialty
                                        for anyone with a row in `vets`. */}
                                    {person.license_no && (
                                        <div style={{ color: 'var(--color-primary)' }}>
                                            <p style={{ margin: 0 }}>Vet License: {person.license_no}</p>
                                            {person.specialty && <p style={{ margin: 0 }}>Specialty: {person.specialty}</p>}
                                        </div>
                                    )}
                                    {person.specialization_species && (
                                        <p style={{ margin: 0 }}>Specialization: {person.specialization_species}</p>
                                    )}
                                    {person.office_location && (
                                        <p style={{ margin: 0 }}>Office: {person.office_location}</p>
                                    )}
                                    {person.manager_id && staffById.has(person.manager_id) && (
                                        <p style={{ margin: 0 }}>
                                            Supervisor: {staffById.get(person.manager_id).first_name} {staffById.get(person.manager_id).last_name}
                                        </p>
                                    )}
                                    {person.contact_info && (
                                        <p style={{ margin: 0 }}>Contact: {person.contact_info}</p>
                                    )}
                                </div>

                                {/* Log button pinned to the bottom-right of every card
                                    — absolute positioning guarantees the same spot
                                    regardless of how tall the content above grows. */}
                                {canManage && (
                                    <LifecycleLogButton
                                        compact
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setLogTarget({
                                                entity: 'employee',
                                                id:   person.employee_id,
                                                name: `${person.first_name} ${person.last_name}`,
                                            });
                                        }}
                                        style={{ position: 'absolute', right: '16px', bottom: '16px' }}
                                    />
                                )}

                            </div>
                        );
                    })}
                </div>
            )}

            {logTarget && (
                <LifecycleLogModal
                    entity={logTarget.entity}
                    id={logTarget.id}
                    name={logTarget.name}
                    onClose={() => setLogTarget(null)}
                />
            )}

            {/* Portaled edit modal — escapes the parent glass-panel backdrop-filter. */}
            {editing && createPortal((
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                }} onClick={cancelEdit}>
                    <div onClick={e => e.stopPropagation()} style={{
                        width: '520px', maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
                        padding: '28px', background: 'rgba(255,255,255,0.96)',
                        border: `1px solid ${GREEN}`, borderRadius: '14px',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ margin: 0, color: GREEN_DARK }}>Edit: {editing.first_name} {editing.last_name}</h2>
                            <button onClick={cancelEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: GREEN_DARK }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleEditSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <div>
                                <label style={staffLabelStyle}>First Name</label>
                                <input required className="glass-input" value={editForm.first_name}
                                    onChange={e => setEditForm({ ...editForm, first_name: e.target.value })} />
                            </div>
                            <div>
                                <label style={staffLabelStyle}>Last Name</label>
                                <input required className="glass-input" value={editForm.last_name}
                                    onChange={e => setEditForm({ ...editForm, last_name: e.target.value })} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={staffLabelStyle}>Department</label>
                                <select required className="glass-input" value={editForm.dept_id}
                                    onChange={e => setEditForm({ ...editForm, dept_id: e.target.value })}>
                                    <option value="">Select department...</option>
                                    {departments.map(d => <option key={d.dept_id} value={d.dept_id}>{d.dept_name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={staffLabelStyle}>Shift Start</label>
                                <input type="time" className="glass-input" value={editForm.shift_start || ''}
                                    onChange={e => setEditForm({ ...editForm, shift_start: e.target.value })} />
                            </div>
                            <div>
                                <label style={staffLabelStyle}>Shift End</label>
                                <input type="time" className="glass-input" value={editForm.shift_end || ''}
                                    onChange={e => setEditForm({ ...editForm, shift_end: e.target.value })} />
                            </div>
                            <div>
                                <label style={staffLabelStyle}>Hourly Rate ($)</label>
                                <input type="number" step="0.01" min="0" className="glass-input" value={editForm.pay_rate}
                                    onChange={e => setEditForm({ ...editForm, pay_rate: e.target.value })} />
                            </div>
                            <div>
                                <label style={staffLabelStyle}>Role</label>
                                <input className="glass-input" value={editForm.role || ''} disabled
                                    title="Role changes aren't supported here — create a new account if needed." />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={staffLabelStyle}>Date of Birth</label>
                                <input type="date" className="glass-input"
                                    max={new Date().toISOString().slice(0, 10)}
                                    value={editForm.date_of_birth || ''}
                                    onChange={e => setEditForm({ ...editForm, date_of_birth: e.target.value })} />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={staffLabelStyle}>Contact Info</label>
                                <input className="glass-input" value={editForm.contact_info}
                                    onChange={e => setEditForm({ ...editForm, contact_info: e.target.value })} />
                            </div>

                            {/* Role-specific fields — fully editable now so the
                                admin can fix a typo or re-stamp a credential
                                without recreating the account. Vet-dept managers
                                keep their clinical fields alongside the office. */}
                            {(editForm.role === 'vet'
                              || (editForm.role === 'manager' && /veterinary/i.test(
                                  (departments.find(d => String(d.dept_id) === String(editForm.dept_id)) || {}).dept_name || ''
                                ))) && (<>
                                <div>
                                    <label style={staffLabelStyle}>Vet License #</label>
                                    <input required className="glass-input" value={editForm.license_no || ''}
                                        onChange={e => setEditForm({ ...editForm, license_no: e.target.value })} />
                                </div>
                                <div>
                                    <label style={staffLabelStyle}>Specialty</label>
                                    <input className="glass-input" value={editForm.specialty || ''}
                                        onChange={e => setEditForm({ ...editForm, specialty: e.target.value })} />
                                </div>
                            </>)}
                            {editForm.role === 'caretaker' && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={staffLabelStyle}>Specialization (species)</label>
                                    <input required className="glass-input" value={editForm.specialization_species || ''}
                                        onChange={e => setEditForm({ ...editForm, specialization_species: e.target.value })} />
                                </div>
                            )}
                            {editForm.role === 'manager' && (
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label style={staffLabelStyle}>Office Location</label>
                                    <input required className="glass-input" value={editForm.office_location || ''}
                                        onChange={e => setEditForm({ ...editForm, office_location: e.target.value })} />
                                </div>
                            )}

                            {/* Supervisor — required for every non-admin. Managers
                                pick from admins; everyone else picks a manager
                                in their dept. */}
                            {editForm.role && editForm.role !== 'admin' && (() => {
                                const isMgr = editForm.role === 'manager';
                                const options = isMgr ? adminsList : deptManagers;
                                const emptyHint = isMgr
                                    ? 'No admins on record yet — create an admin first.'
                                    : 'No managers in this department yet — create a manager first.';
                                return (
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <label style={staffLabelStyle}>{isMgr ? 'Supervisor (admin)' : 'Supervisor'}</label>
                                        <select required className="glass-input"
                                            value={editForm.manager_id}
                                            onChange={e => setEditForm({ ...editForm, manager_id: e.target.value })}>
                                            <option value="" disabled>
                                                {options.length === 0 ? emptyHint : 'Select supervisor...'}
                                            </option>
                                            {options.map(m => (
                                                <option key={m.employee_id} value={m.employee_id}>
                                                    {m.first_name} {m.last_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })()}

                            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', marginTop: '4px' }}>
                                <button type="button" onClick={cancelEdit} className="glass-button" style={{ flex: 1 }}>
                                    Cancel
                                </button>
                                <button type="submit" className="glass-button" style={{ flex: 2, background: GREEN, color: 'white', fontWeight: 700 }}>
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            ), document.body)}

            {manageMode && (
                <BulkActionBar
                    count={selected.size}
                    onSelectAll={selectAllVisible}
                    onRemove={handleRemoveSelected}
                    onCancel={exitManageMode}
                    actionLabel="Deactivate Selected"
                />
            )}
        </div>
    );
}

// BulkActionBar moved to /components/BulkActionBar.jsx (shared + portaled).

const staffLabelStyle = {
    display: 'block',
    fontSize: '11px',
    color: GREEN_DARK,
    marginBottom: '4px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
};
