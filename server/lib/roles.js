// ============================================================
// Role / scope helpers shared between routes. Keeps the "who
// can do X" rules in one place so animals.js + events.js stay
// honest and future endpoints don't drift.
//
// The rules live here; every protected endpoint uses the same
// vocabulary:
//
//   isAnimalDept(deptName)           → pure string check
//   fetchDeptName(deptId)            → cheap SELECT helper
//   isAnimalDeptManager(user)        → admin OR manager whose
//                                       dept touches animals
//   managerOwnsEmployee(user, empId) → manager can do X with
//                                       their own staff (or admin)
//   staffAssignedToAnimal(empId, id) → vet/caretaker-animal FK
//                                       membership
// ============================================================
import db from '../db.js';

export function isAnimalDept(deptName) {
    const n = (deptName || '').toLowerCase();
    return n.includes('vet') || n.includes('animal') || n.includes('care');
}

export async function fetchDeptName(deptId) {
    if (!deptId) return null;
    const [rows] = await db.query(
        'SELECT dept_name FROM departments WHERE dept_id = ?', [deptId]
    );
    return rows[0]?.dept_name || null;
}

// admin OR a manager whose department works with animals (Vet /
// Animal Care). Non-animal managers (Retail, Security) get false.
export async function isAnimalDeptManager(user) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role !== 'manager') return false;
    const name = await fetchDeptName(user.deptId);
    return isAnimalDept(name);
}

// admin OR a Vet *department* manager (not a vet employee).
export async function isVetDeptManager(user) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role !== 'manager') return false;
    const name = (await fetchDeptName(user.deptId) || '').toLowerCase();
    return name.includes('vet');
}

// admin OR an Animal Care *department* manager.
export async function isCaretakerDeptManager(user) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role !== 'manager') return false;
    const name = (await fetchDeptName(user.deptId) || '').toLowerCase();
    return name.includes('animal') || name.includes('care');
}

// True if `user` is authorised to do things with employee `empId`
// (admin, or the employee reports up to this manager, or it *is*
// this user).
export async function managerOwnsEmployee(user, empId) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.employeeId && Number(user.employeeId) === Number(empId)) return true;
    if (user.role !== 'manager') return false;
    const [rows] = await db.query(
        'SELECT manager_id FROM employees WHERE employee_id = ? AND is_active = 1',
        [empId]
    );
    return rows[0]?.manager_id === user.employeeId;
}

export async function isVetAssignedToAnimal(employeeId, animalId) {
    if (!employeeId || !animalId) return false;
    const [rows] = await db.query(
        'SELECT 1 FROM vet_animal_assignments WHERE vet_id = ? AND animal_id = ? LIMIT 1',
        [employeeId, animalId]
    );
    return rows.length > 0;
}

export async function isCaretakerAssignedToAnimal(employeeId, animalId) {
    if (!employeeId || !animalId) return false;
    const [rows] = await db.query(
        'SELECT 1 FROM caretaker_animal_assignments WHERE caretaker_id = ? AND animal_id = ? LIMIT 1',
        [employeeId, animalId]
    );
    return rows.length > 0;
}
