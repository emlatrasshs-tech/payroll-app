import React, {
  useState, useReducer, useContext, createContext,
  useCallback, useMemo, useRef, useEffect
} from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Users, DollarSign, FileText, BarChart2, Clock, History,
  Plus, Edit2, Trash2, Eye, X, Check, AlertCircle,
  Search, Calendar, Building2, Briefcase, CreditCard,
  Menu, ChevronDown, Printer, TrendingUp, Home,
  ChevronRight, Download, RefreshCw, UserCheck,
  ChevronUp, Bell, Filter, ArrowUpRight, ArrowDownRight, Timer
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// CONSTANTS & UTILITIES
// ─────────────────────────────────────────────────────────────
const DEPARTMENTS = ['Events', 'Social Media', 'Human Resources', 'Operations'];
const DEPT_COLORS = {
  Events: '#c2410c', 'Social Media': '#f59e0b',
  'Human Resources': '#10b981', Operations: '#ec4899'
};
const CHART_COLORS = ['#c2410c','#f59e0b','#10b981','#ec4899','#3b82f6','#8b5cf6'];
const POSITIONS = {
  Events:           ['Events and Logistics Support Coordinator','Event Coordinator Assistant','Account Manager','Events and Account Manager','Event Assistant'],
  'Social Media':   ['Graphic & Social Media Specialist','Marketing and Creative Assistant','Social Media Manager','Content Creator'],
  'Human Resources':['HR Assistant','HR Manager','HR Specialist','Recruiter'],
  Operations:       ['Executive Driver','Photographer','Operations Manager','Office Assistant'],
};
const EMP_TYPES = ['Regular','Probationary','Full-Time','Part-Time','Contractor'];
const PAY_FREQS = ['Bi-Monthly','Monthly','Bi-Weekly','Weekly'];
const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

const fmt = (n) => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:2}).format(n||0);
const fmtNum = (n) => new Intl.NumberFormat('en-PH',{maximumFractionDigits:2}).format(n||0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}) : '—';
const today = () => new Date().toISOString().split('T')[0];
const uid = () => Math.random().toString(36).slice(2,9);

// Philippine Income Tax (TRAIN Law – monthly)
function calcTax(taxable) {
  if (taxable <= 20833) return 0;
  if (taxable <= 33332) return (taxable - 20833) * 0.20;
  if (taxable <= 66666) return 2500 + (taxable - 33333) * 0.25;
  if (taxable <= 166666) return 10833.33 + (taxable - 66667) * 0.30;
  if (taxable <= 666666) return 40833.33 + (taxable - 166667) * 0.32;
  return 200833.33 + (taxable - 666667) * 0.35;
}

function calcGovContribs(monthlySalary) {
  const sss      = Math.min(monthlySalary * 0.045, 900);
  const philHealth = Math.min(Math.max(monthlySalary * 0.025, 250), 2500);
  const pagIbig  = monthlySalary <= 1500 ? monthlySalary * 0.01 : Math.min(monthlySalary * 0.02, 200);
  return { sss, philHealth, pagIbig };
}

// cutOff: 1 = basic half-salary only, no allowance, no gov deductions
//         2 = basic half-salary + allowance, apply gov deductions (no tax per policy)
function calcPayslip(emp, periodDays = 11, absences = 0, lateMinutes = 0, overtime = 0, cutOff = 2) {
  const monthlySalary = emp.salary || 0;
  const halfSalary    = monthlySalary / 2;
  const allowance     = cutOff === 2 ? (emp.allowance || 0) : 0;
  const reimbursement = 0; // user-entered per payslip; default 0
  const sssLoan       = 0; // user-entered per payslip; default 0
  const hdmfLoan      = 0; // user-entered per payslip; default 0
  const dailyRate     = monthlySalary / 22;
  const workingDays   = 11; // each cut-off has ~11 working days
  const daysAttended  = Math.max(0, workingDays - absences);
  const absenceDeduct = dailyRate * absences;
  const lateDeduct    = (dailyRate / 8 / 60) * lateMinutes;
  const overtimePay   = (dailyRate / 8) * 1.25 * overtime;
  const grossPay      = Math.max(0, halfSalary + allowance + reimbursement - absenceDeduct - lateDeduct + overtimePay);

  // Gov deductions only on Cut-Off 2; tax excluded per company policy
  let sss = 0, philHealth = 0, pagIbig = 0;
  if (cutOff === 2) {
    const gov = calcGovContribs(monthlySalary);
    sss       = gov.sss;
    philHealth = gov.philHealth;
    pagIbig   = gov.pagIbig;
  }

  const totalDeduct = sss + philHealth + pagIbig + sssLoan + hdmfLoan;
  const netPay      = grossPay - totalDeduct;
  return {
    grossPay, baseSalary: halfSalary, allowance, reimbursement,
    absenceDeduct, lateDeduct, overtimePay,
    sss, philHealth, pagIbig, tax: 0, sssLoan, hdmfLoan,
    totalDeductions: totalDeduct, netPay,
    dailyRate, workingDays, daysAttended, absences, lateMinutes, overtime, cutOff,
  };
}

// ─────────────────────────────────────────────────────────────
// CUT-OFF SCHEDULE ENGINE
// ─────────────────────────────────────────────────────────────
function getLastDayOfMonth(year, month) {
  // month is 1-based (1=Jan … 12=Dec)
  // new Date(year, month, 0) gives the last day of [month]
  return new Date(year, month, 0).getDate();
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function pad(n) { return String(n).padStart(2, '0'); }

function getCutOffSchedule(year, month) {
  // month: 1-based
  const lastDay   = getLastDayOfMonth(year, month);
  const monthName = MONTH_NAMES[month - 1];

  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear  = month === 12 ? year + 1 : year;

  return {
    monthName, year, lastDay,
    isLeap: month === 2 && isLeapYear(year),

    cutOff1: {
      num:         1,
      label:       `${monthName} 1–15`,
      coverage:    `${monthName} 1–15, ${year}`,
      startDate:   `${year}-${pad(month)}-01`,
      endDate:     `${year}-${pad(month)}-15`,
      releaseDate: `${year}-${pad(month)}-22`,
      periodLabel: `${monthName} 1–15, ${year}`,
      releaseDateLabel: `${monthName} 22, ${year}`,
    },

    cutOff2: {
      num:         2,
      label:       `${monthName} 16–${lastDay}`,
      coverage:    `${monthName} 16–${lastDay}, ${year}`,
      startDate:   `${year}-${pad(month)}-16`,
      endDate:     `${year}-${pad(month)}-${pad(lastDay)}`,
      releaseDate: `${nextYear}-${pad(nextMonth)}-08`,
      periodLabel: `${monthName} 16–${lastDay}, ${year}`,
      releaseDateLabel: `${MONTH_NAMES[nextMonth - 1]} 8, ${nextYear}`,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// OT COMPUTATION ENGINE  (DOLE-compliant)
// ─────────────────────────────────────────────────────────────
const OT_TYPES = [
  { id:'regular', label:'Regular OT',         regularMult:0,    otMult:1.25, color:'bg-blue-100 text-blue-700'   },
  { id:'restday', label:'Rest Day OT',         regularMult:1.30, otMult:1.69, color:'bg-orange-100 text-orange-700'},
  { id:'reghol',  label:'Regular Holiday OT',  regularMult:2.00, otMult:2.60, color:'bg-red-100 text-red-700'    },
  { id:'spechol', label:'Special Holiday OT',  regularMult:1.30, otMult:1.69, color:'bg-teal-100 text-teal-700'  },
];

function parseTimeMins(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function fmt12h(t) {
  if (!t) return '—';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`;
}

// Dragon AI schedule rules
// Mon–Fri: 9:00 AM – 6:00 PM  |  Saturday: 10:00 AM – 3:00 PM  |  Sunday: Rest Day
function getDaySchedule(dateStr) {
  const empty = { label:'—', schedStart:null, schedEnd:null, lunchDeduct:false, isRestDay:true, dayName:'—' };
  if (!dateStr) return empty;
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0=Sun 1=Mon…6=Sat
  const names = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  if (day >= 1 && day <= 5) return { label:'Mon – Fri  (9:00 AM – 6:00 PM)', schedStart:9*60,  schedEnd:18*60, lunchDeduct:true,  isRestDay:false, dayName:names[day] };
  if (day === 6)             return { label:'Saturday  (10:00 AM – 3:00 PM)', schedStart:10*60, schedEnd:15*60, lunchDeduct:false, isRestDay:false, dayName:'Saturday' };
  return { label:'Sunday — Rest Day', schedStart:null, schedEnd:null, lunchDeduct:false, isRestDay:true, dayName:'Sunday' };
}

const OT_MIN_MINUTES = 30; // OT is only counted at ≥ 30 minutes

// Philippine Public Holidays (2024 – 2027)
const PH_HOLIDAYS = {
  // ── 2024 ──
  '2024-01-01':{ name:"New Year's Day",              type:'reghol'  },
  '2024-02-10':{ name:'Chinese New Year',             type:'spechol' },
  '2024-02-25':{ name:'EDSA People Power Revolution', type:'spechol' },
  '2024-03-28':{ name:'Maundy Thursday',              type:'reghol'  },
  '2024-03-29':{ name:'Good Friday',                  type:'reghol'  },
  '2024-03-30':{ name:'Black Saturday',               type:'spechol' },
  '2024-04-09':{ name:'Araw ng Kagitingan',            type:'reghol'  },
  '2024-05-01':{ name:'Labor Day',                    type:'reghol'  },
  '2024-06-12':{ name:'Independence Day',             type:'reghol'  },
  '2024-08-21':{ name:'Ninoy Aquino Day',             type:'spechol' },
  '2024-08-26':{ name:'National Heroes Day',          type:'reghol'  },
  '2024-10-31':{ name:"All Saints' Day Eve",          type:'spechol' },
  '2024-11-01':{ name:"All Saints' Day",              type:'spechol' },
  '2024-11-02':{ name:"All Souls' Day",               type:'spechol' },
  '2024-11-30':{ name:'Bonifacio Day',                type:'reghol'  },
  '2024-12-08':{ name:'Immaculate Conception',        type:'spechol' },
  '2024-12-24':{ name:'Christmas Eve',                type:'spechol' },
  '2024-12-25':{ name:'Christmas Day',                type:'reghol'  },
  '2024-12-30':{ name:'Rizal Day',                    type:'reghol'  },
  '2024-12-31':{ name:"New Year's Eve",               type:'spechol' },
  // ── 2025 ──
  '2025-01-01':{ name:"New Year's Day",              type:'reghol'  },
  '2025-01-29':{ name:'Chinese New Year',             type:'spechol' },
  '2025-02-25':{ name:'EDSA People Power Revolution', type:'spechol' },
  '2025-04-09':{ name:'Araw ng Kagitingan',            type:'reghol'  },
  '2025-04-17':{ name:'Maundy Thursday',              type:'reghol'  },
  '2025-04-18':{ name:'Good Friday',                  type:'reghol'  },
  '2025-04-19':{ name:'Black Saturday',               type:'spechol' },
  '2025-05-01':{ name:'Labor Day',                    type:'reghol'  },
  '2025-06-12':{ name:'Independence Day',             type:'reghol'  },
  '2025-08-21':{ name:'Ninoy Aquino Day',             type:'spechol' },
  '2025-08-25':{ name:'National Heroes Day',          type:'reghol'  },
  '2025-10-31':{ name:"All Saints' Day Eve",          type:'spechol' },
  '2025-11-01':{ name:"All Saints' Day",              type:'spechol' },
  '2025-11-02':{ name:"All Souls' Day",               type:'spechol' },
  '2025-11-30':{ name:'Bonifacio Day',                type:'reghol'  },
  '2025-12-08':{ name:'Immaculate Conception',        type:'spechol' },
  '2025-12-24':{ name:'Christmas Eve',                type:'spechol' },
  '2025-12-25':{ name:'Christmas Day',                type:'reghol'  },
  '2025-12-30':{ name:'Rizal Day',                    type:'reghol'  },
  '2025-12-31':{ name:"New Year's Eve",               type:'spechol' },
  // ── 2026 ──
  '2026-01-01':{ name:"New Year's Day",              type:'reghol'  },
  '2026-01-17':{ name:'Chinese New Year',             type:'spechol' },
  '2026-02-25':{ name:'EDSA People Power Revolution', type:'spechol' },
  '2026-04-02':{ name:'Maundy Thursday',              type:'reghol'  },
  '2026-04-03':{ name:'Good Friday',                  type:'reghol'  },
  '2026-04-04':{ name:'Black Saturday',               type:'spechol' },
  '2026-04-09':{ name:'Araw ng Kagitingan',            type:'reghol'  },
  '2026-05-01':{ name:'Labor Day',                    type:'reghol'  },
  '2026-06-12':{ name:'Independence Day',             type:'reghol'  },
  '2026-08-21':{ name:'Ninoy Aquino Day',             type:'spechol' },
  '2026-08-31':{ name:'National Heroes Day',          type:'reghol'  },
  '2026-10-31':{ name:"All Saints' Day Eve",          type:'spechol' },
  '2026-11-01':{ name:"All Saints' Day",              type:'spechol' },
  '2026-11-02':{ name:"All Souls' Day",               type:'spechol' },
  '2026-11-30':{ name:'Bonifacio Day',                type:'reghol'  },
  '2026-12-08':{ name:'Immaculate Conception',        type:'spechol' },
  '2026-12-24':{ name:'Christmas Eve',                type:'spechol' },
  '2026-12-25':{ name:'Christmas Day',                type:'reghol'  },
  '2026-12-30':{ name:'Rizal Day',                    type:'reghol'  },
  '2026-12-31':{ name:"New Year's Eve",               type:'spechol' },
  // ── 2027 ──
  '2027-01-01':{ name:"New Year's Day",              type:'reghol'  },
  '2027-02-06':{ name:'Chinese New Year',             type:'spechol' },
  '2027-02-25':{ name:'EDSA People Power Revolution', type:'spechol' },
  '2027-03-25':{ name:'Maundy Thursday',              type:'reghol'  },
  '2027-03-26':{ name:'Good Friday',                  type:'reghol'  },
  '2027-03-27':{ name:'Black Saturday',               type:'spechol' },
  '2027-04-09':{ name:'Araw ng Kagitingan',            type:'reghol'  },
  '2027-05-01':{ name:'Labor Day',                    type:'reghol'  },
  '2027-06-12':{ name:'Independence Day',             type:'reghol'  },
  '2027-08-21':{ name:'Ninoy Aquino Day',             type:'spechol' },
  '2027-08-30':{ name:'National Heroes Day',          type:'reghol'  },
  '2027-10-31':{ name:"All Saints' Day Eve",          type:'spechol' },
  '2027-11-01':{ name:"All Saints' Day",              type:'spechol' },
  '2027-11-02':{ name:"All Souls' Day",               type:'spechol' },
  '2027-11-30':{ name:'Bonifacio Day',                type:'reghol'  },
  '2027-12-08':{ name:'Immaculate Conception',        type:'spechol' },
  '2027-12-24':{ name:'Christmas Eve',                type:'spechol' },
  '2027-12-25':{ name:'Christmas Day',                type:'reghol'  },
  '2027-12-30':{ name:'Rizal Day',                    type:'reghol'  },
  '2027-12-31':{ name:"New Year's Eve",               type:'spechol' },
};

// Returns the auto-suggested OT type for a given date
// Priority: Holiday > Rest Day (Sat/Sun) > Regular
function autoOTType(dateStr) {
  if (!dateStr) return 'regular';
  if (PH_HOLIDAYS[dateStr]) return PH_HOLIDAYS[dateStr].type;
  const day = new Date(dateStr + 'T00:00:00').getDay();
  if (day === 0 || day === 6) return 'restday';
  return 'regular';
}

function calcOTHours(timeIn, timeOut, dateStr) {
  const dayInfo = getDaySchedule(dateStr);
  const zero = { totalHours:0, workHours:0, regularHours:0, otHours:0, otMins:0, ndHours:0, dayInfo };
  if (!timeIn || !timeOut) return zero;

  let inM  = parseTimeMins(timeIn);
  let outM = parseTimeMins(timeOut);
  if (outM <= inM) outM += 1440; // overnight shift

  const totalMins = outM - inM;

  // Determine OT minutes —————————————————————————————————
  let otMins   = 0;
  let workMins = totalMins;

  if (dayInfo.isRestDay) {
    // Sunday: every minute worked is OT (Rest Day)
    otMins = totalMins;
  } else {
    // Deduct 1-hr lunch break on Mon–Fri when total time > 5 hrs
    if (dayInfo.lunchDeduct && totalMins > 300) workMins = totalMins - 60;

    if (inM >= dayInfo.schedEnd) {
      // Employee clocked in entirely after regular schedule → all is OT
      otMins = workMins;
    } else {
      // OT = minutes worked past the schedule end
      otMins = Math.max(0, outM - dayInfo.schedEnd);
    }
  }

  // 30-minute minimum rule: if OT < 30 min, it is not counted
  if (otMins < OT_MIN_MINUTES) otMins = 0;

  const otHours      = otMins / 60;
  const workHours    = workMins / 60;
  const regularHours = Math.max(0, workHours - otHours);

  // Night Differential: auto-computed for overlap with 10 PM – 6 AM ————
  const ND_START = 22 * 60; // 1320 (10 PM)
  const ND_MID   = 24 * 60; // 1440 (midnight)
  const ND_END   = 30 * 60; // 1800 (next-day 6 AM, normalised)
  let ndMins = 0;
  ndMins += Math.max(0, Math.min(outM, ND_MID) - Math.max(inM, ND_START)); // 10 PM–midnight
  ndMins += Math.max(0, Math.min(outM, ND_END)  - Math.max(inM, ND_MID));  // midnight–6 AM
  const ndHours = Math.max(0, ndMins / 60);

  return { totalHours: totalMins / 60, workHours, regularHours, otHours, otMins, ndHours, dayInfo };
}

function calcOTPay(dailyRate, hours, otTypeId) {
  const hourlyRate     = (dailyRate || 0) / 8;
  const cfg            = OT_TYPES.find(t => t.id === otTypeId) || OT_TYPES[0];
  const regularPremium = hours.regularHours * hourlyRate * cfg.regularMult;
  const otPremium      = hours.otHours      * hourlyRate * cfg.otMult;
  const totalOTPay     = regularPremium + otPremium;
  const ndPay          = hours.ndHours * hourlyRate * 0.10; // always auto-computed from overlap
  return { regularPremium, otPremium, totalOTPay, ndPay, total: totalOTPay + ndPay };
}

// ─────────────────────────────────────────────────────────────
// INITIAL DATA
// ─────────────────────────────────────────────────────────────
// ── Dragon AI Media Inc — Active Employees (sourced from Dragon AI Database.xlsx) ──
const SEED_EMPLOYEES = [
  { id:'E001', name:'Maverick Avien Acuario',       dept:'Events',          position:'Events and Logistics Support Coordinator', type:'Probationary', salary:25000, allowance:200, hireDate:'2025-10-08', taxEx:0, bank:'8029', isHourly:false },
  { id:'E002', name:'Nikka Rose Barcelon',           dept:'Social Media',    position:'Graphic & Social Media Specialist',        type:'Regular',      salary:28000, allowance:0,   hireDate:'2024-10-28', taxEx:0, bank:'2007', isHourly:false },
  { id:'E003', name:'Yasmin May Cai',                dept:'Events',          position:'Event Coordinator Assistant',              type:'Probationary', salary:40000, allowance:0,   hireDate:'2026-02-18', taxEx:0, bank:'8726', isHourly:false },
  { id:'E004', name:'Eliney Crisse Nicole Castillon',dept:'Events',          position:'Account Manager',                          type:'Probationary', salary:45000, allowance:0,   hireDate:'2025-06-09', taxEx:0, bank:'3775', isHourly:false },
  { id:'E005', name:'Raphael Oliver Cobarrubias',    dept:'Operations',      position:'Photographer',                             type:'Regular',      salary:33000, allowance:0,   hireDate:'2022-11-09', taxEx:0, bank:'0943', isHourly:false },
  { id:'E006', name:'Hazel Marie De Jesus',          dept:'Events',          position:'Events and Account Manager',               type:'Regular',      salary:48000, allowance:0,   hireDate:'2024-11-18', taxEx:0, bank:'2752', isHourly:false },
  { id:'E007', name:'Denise Diocena',                dept:'Social Media',    position:'Marketing and Creative Assistant',         type:'Regular',      salary:22000, allowance:0,   hireDate:'2024-11-12', taxEx:0, bank:'4539', isHourly:false },
  { id:'E008', name:'El Marie Latras',               dept:'Human Resources', position:'HR Assistant',                             type:'Regular',      salary:23500, allowance:0,   hireDate:'2024-10-01', taxEx:0, bank:'3244', isHourly:false },
  { id:'E009', name:'Denise Rosalind Lim',           dept:'Events',          position:'TBD',                                      type:'Regular',      salary:0,     allowance:0,   hireDate:'2017-01-30', taxEx:0, bank:'1399', isHourly:false },
  { id:'E010', name:'Paolo Luis Navarro',             dept:'Events',          position:'Account Manager',                          type:'Probationary', salary:35000, allowance:0,   hireDate:'2026-03-16', taxEx:0, bank:'3920', isHourly:false },
  { id:'E011', name:'John Maynard Pabelona',          dept:'Events',          position:'Events and Logistics Support Coordinator', type:'Regular',      salary:31000, allowance:180, hireDate:'2025-07-29', taxEx:0, bank:'7783', isHourly:false },
  { id:'E012', name:'Mark Yuri Patawaran',            dept:'Events',          position:'Events and Logistics Support Coordinator', type:'Regular',      salary:31000, allowance:180, hireDate:'2025-07-07', taxEx:0, bank:'0416', isHourly:false },
  { id:'E013', name:'Lexie Joan Remetio',             dept:'Events',          position:'Event Assistant',                          type:'Probationary', salary:26500, allowance:0,   hireDate:'2026-03-02', taxEx:0, bank:'1824', isHourly:false },
  { id:'E014', name:'Rolando Sabanal',                dept:'Operations',      position:'Executive Driver',                         type:'Regular',      salary:32000, allowance:180, hireDate:'2025-03-31', taxEx:0, bank:'7019', isHourly:false },
];

function buildPayslips(employees, periodLabel, dateStr, cutOff = 2) {
  return employees.map(emp => {
    const absences = Math.floor(Math.random() * 2);
    const late     = cutOff === 1 ? 0 : Math.floor(Math.random() * 3) * 30;
    const ot       = Math.floor(Math.random() * 8);
    const calc     = calcPayslip(emp, 11, absences, late, ot, cutOff);
    return { id: uid(), employeeId: emp.id, ...calc, period: periodLabel, date: dateStr, status:'Paid' };
  });
}

// Build seed runs using the cut-off schedule engine
const SEED_PERIODS = [
  { year:2026, month:1,  co:1 },   // Jan Cut-Off 1  → release Jan 22
  { year:2026, month:1,  co:2 },   // Jan Cut-Off 2  → release Feb 8
  { year:2026, month:2,  co:1 },   // Feb Cut-Off 1  → release Feb 22
  { year:2026, month:2,  co:2 },   // Feb Cut-Off 2  → release Mar 8
  { year:2026, month:3,  co:1 },   // Mar Cut-Off 1  → release Mar 22
];

const SEED_RUNS = SEED_PERIODS.map((p, i) => {
  const sched = getCutOffSchedule(p.year, p.month);
  const co    = p.co === 1 ? sched.cutOff1 : sched.cutOff2;
  return {
    id:          uid(),
    period:      co.periodLabel,
    coverage:    co.coverage,
    cutOff:      p.co,
    frequency:   'Bi-Monthly',
    startDate:   co.startDate,
    date:        co.endDate,
    releaseDate: co.releaseDate,
    releaseDateLabel: co.releaseDateLabel,
    status:      i < 4 ? 'Paid' : 'Processing',
    payslips:    buildPayslips(SEED_EMPLOYEES, co.periodLabel, co.endDate, p.co),
  };
});

const SEED_ATTENDANCE = SEED_EMPLOYEES.slice(0,5).map(emp => ({
  id: uid(),
  employeeId: emp.id,
  date: today(),
  type: Math.random() > 0.5 ? 'Absent' : 'Late',
  minutes: Math.floor(Math.random() * 120) + 15,
  reason: 'Personal',
}));

// ─────────────────────────────────────────────────────────────
// STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────
const initialState = {
  employees:   SEED_EMPLOYEES,
  payrollRuns: SEED_RUNS,
  attendance:  SEED_ATTENDANCE,
  otEntries:   [],
  toasts:      [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'ADD_EMPLOYEE':
      return { ...state, employees: [...state.employees, action.payload] };
    case 'UPDATE_EMPLOYEE':
      return { ...state, employees: state.employees.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE_EMPLOYEE':
      return { ...state, employees: state.employees.filter(e => e.id !== action.id) };
    case 'ADD_PAYROLL_RUN':
      return { ...state, payrollRuns: [action.payload, ...state.payrollRuns] };
    case 'UPDATE_RUN_STATUS':
      return { ...state, payrollRuns: state.payrollRuns.map(r => r.id === action.id ? {...r, status: action.status} : r) };
    case 'ADD_ATTENDANCE':
      return { ...state, attendance: [action.payload, ...state.attendance] };
    case 'DELETE_ATTENDANCE':
      return { ...state, attendance: state.attendance.filter(a => a.id !== action.id) };
    case 'ADD_OT_ENTRY':
      return { ...state, otEntries: [action.payload, ...state.otEntries] };
    case 'UPDATE_OT_ENTRY':
      return { ...state, otEntries: state.otEntries.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE_OT_ENTRY':
      return { ...state, otEntries: state.otEntries.filter(e => e.id !== action.id) };
    case 'ADD_OT_ENTRIES':
      return { ...state, otEntries: [...action.payload, ...state.otEntries] };
    case 'TOAST':
      return { ...state, toasts: [...state.toasts, { id: uid(), ...action.payload }] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.id) };
    default: return state;
  }
}

const AppCtx = createContext(null);
function useApp() { return useContext(AppCtx); }

// ─────────────────────────────────────────────────────────────
// TOAST SYSTEM
// ─────────────────────────────────────────────────────────────
function Toasts() {
  const { state, dispatch } = useApp();
  useEffect(() => {
    state.toasts.forEach(t => {
      const timer = setTimeout(() => dispatch({ type:'REMOVE_TOAST', id: t.id }), 3500);
      return () => clearTimeout(timer);
    });
  }, [state.toasts]);
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {state.toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium min-w-64 animate-pulse
          ${t.variant==='error' ? 'bg-red-500' : t.variant==='warning' ? 'bg-yellow-500' : 'bg-emerald-500'}`}>
          {t.variant==='error' ? <AlertCircle size={16}/> : <Check size={16}/>}
          {t.message}
          <button onClick={() => dispatch({ type:'REMOVE_TOAST', id: t.id })} className="ml-auto"><X size={14}/></button>
        </div>
      ))}
    </div>
  );
}
function toast(dispatch, message, variant='success') {
  dispatch({ type:'TOAST', payload:{ message, variant } });
}

// ─────────────────────────────────────────────────────────────
// MODAL
// ─────────────────────────────────────────────────────────────
function Modal({ isOpen, onClose, title, children, wide, extraWide }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${extraWide ? 'max-w-5xl' : wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-lg">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"><X size={20}/></button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SHARED UI
// ─────────────────────────────────────────────────────────────
function Badge({ status }) {
  const map = {
    Paid:          'bg-emerald-100 text-emerald-700',
    Pending:       'bg-yellow-100 text-yellow-700',
    Processing:    'bg-blue-100 text-blue-700',
    'Full-Time':   'bg-orange-100 text-orange-800',
    'Part-Time':   'bg-purple-100 text-purple-700',
    Contractor:    'bg-orange-100 text-orange-700',
    Regular:              'bg-emerald-100 text-emerald-700',
    Probationary:         'bg-amber-100 text-amber-700',
    Absent:               'bg-red-100 text-red-700',
    Late:                 'bg-yellow-100 text-yellow-700',
    'Regular OT':         'bg-blue-100 text-blue-700',
    'Rest Day OT':        'bg-orange-100 text-orange-700',
    'Regular Holiday OT': 'bg-red-100 text-red-700',
    'Special Holiday OT': 'bg-teal-100 text-teal-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status]||'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

function StatCard({ icon: Icon, label, value, sub, color='indigo', trend }) {
  const colors = {
    indigo:'bg-orange-50 text-orange-700', green:'bg-emerald-50 text-emerald-600',
    amber:'bg-amber-50 text-amber-600', pink:'bg-pink-50 text-pink-600',
  };
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
      <div className={`p-3 rounded-xl ${colors[color]}`}><Icon size={22}/></div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-800 mt-1 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${trend>=0?'text-emerald-600':'text-red-500'}`}>
          {trend>=0 ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
  );
}

function Input({ label, error, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>}
      <input
        className={`w-full px-3 py-2 text-sm rounded-lg border ${error?'border-red-400':'border-gray-200'} focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50`}
        {...props}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>}
      <select className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50" {...props}>
        {children}
      </select>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EMPLOYEE FORM
// ─────────────────────────────────────────────────────────────
function EmployeeForm({ initial, onSave, onClose }) {
  const nextId = 'E' + String(Math.floor(Math.random()*900)+100).padStart(3,'0');
  const [form, setForm] = useState(initial || {
    id: nextId, name:'', dept:'Events', position:'',
    type:'Regular', salary:'', allowance:'', hireDate: today(), taxEx: 0, bank:'', isHourly:false,
  });
  const [errs, setErrs] = useState({});

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    if (form.salary === '' || isNaN(form.salary) || +form.salary < 0) e.salary = 'Valid salary required';
    if (!form.bank.match(/^\d{4}$/)) e.bank = 'Enter last 4 digits of bank account';
    setErrs(e);
    return !Object.keys(e).length;
  };

  const submit = () => {
    if (!validate()) return;
    onSave({ ...form, salary: +form.salary, allowance: +form.allowance || 0, taxEx: +form.taxEx });
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="col-span-2"><Input label="Full Name" value={form.name} onChange={e=>f('name',e.target.value)} error={errs.name} placeholder="e.g. Juan dela Cruz"/></div>
      <Select label="Department" value={form.dept} onChange={e=>f('dept',e.target.value)}>
        {DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
      </Select>
      <Input label="Position / Job Title" value={form.position} onChange={e=>f('position',e.target.value)} placeholder="e.g. Account Manager"/>
      <Select label="Employment Status" value={form.type} onChange={e=>f('type',e.target.value)}>
        {EMP_TYPES.map(t=><option key={t}>{t}</option>)}
      </Select>
      <Input label="Joining Date" type="date" value={form.hireDate} onChange={e=>f('hireDate',e.target.value)}/>
      <Input label="Current Monthly Salary (PHP)" type="number" value={form.salary} onChange={e=>f('salary',e.target.value)} error={errs.salary} placeholder="e.g. 25000"/>
      <Input label="Load Allowance (PHP / month)" type="number" value={form.allowance} onChange={e=>f('allowance',e.target.value)} placeholder="e.g. 200 — leave blank if none"/>
      <Select label="Tax Exemptions (dependents)" value={form.taxEx} onChange={e=>f('taxEx',e.target.value)}>
        {[0,1,2,3,4].map(n=><option key={n} value={n}>{n} dependent{n!==1?'s':''}</option>)}
      </Select>
      <Input label="Bank Account (last 4 digits)" value={form.bank} onChange={e=>f('bank',e.target.value.replace(/\D/g,'').slice(0,4))} error={errs.bank} placeholder="XXXX"/>
      <div className="col-span-2 flex gap-3 justify-end pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
        <button onClick={submit} className="px-5 py-2 text-sm rounded-lg bg-orange-700 text-white hover:bg-orange-800 font-medium">
          {initial ? 'Save Changes' : 'Add Employee'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EMPLOYEE MANAGEMENT PAGE
// ─────────────────────────────────────────────────────────────
function EmployeeManagement() {
  const { state, dispatch } = useApp();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);

  const filtered = useMemo(() => state.employees.filter(e =>
    (deptFilter==='All'||e.dept===deptFilter) &&
    (typeFilter==='All'||e.type===typeFilter) &&
    (e.name.toLowerCase().includes(search.toLowerCase()) || e.id.includes(search))
  ), [state.employees, search, deptFilter, typeFilter]);

  const addEmp = (emp) => {
    dispatch({ type:'ADD_EMPLOYEE', payload: emp });
    toast(dispatch, `${emp.name} added successfully`);
    setShowAdd(false);
  };
  const updateEmp = (emp) => {
    dispatch({ type:'UPDATE_EMPLOYEE', payload: emp });
    toast(dispatch, `${emp.name} updated`);
    setEditing(null);
  };
  const deleteEmp = (id) => {
    const emp = state.employees.find(e=>e.id===id);
    dispatch({ type:'DELETE_EMPLOYEE', id });
    toast(dispatch, `${emp.name} removed`, 'warning');
    setDelConfirm(null);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Employees</h1>
          <p className="text-sm text-gray-500">{state.employees.length} total employees</p>
        </div>
        <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-700 text-white rounded-xl text-sm font-medium hover:bg-orange-800 shadow-sm">
          <Plus size={16}/> Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-2.5 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or ID…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400"/>
        </div>
        <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50">
          <option>All</option>{DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
        </select>
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50">
          <option>All</option>{EMP_TYPES.map(t=><option key={t}>{t}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                {['ID','Name','Department','Position','Status','Salary','Allowance','Joining Date','Bank','Actions'].map(h=>(
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(emp=>(
                <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{emp.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{emp.name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-md text-xs font-medium" style={{background:DEPT_COLORS[emp.dept]+'22',color:DEPT_COLORS[emp.dept]||'#c2410c'}}>
                      {emp.dept}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-40 truncate" title={emp.position}>{emp.position||'—'}</td>
                  <td className="px-4 py-3"><Badge status={emp.type}/></td>
                  <td className="px-4 py-3 font-medium text-gray-800">{emp.salary > 0 ? fmt(emp.salary) : <span className="text-gray-300">TBD</span>}</td>
                  <td className="px-4 py-3 text-gray-500">{emp.allowance > 0 ? <span className="text-emerald-600 font-medium">+{fmt(emp.allowance)}</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(emp.hireDate)}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono">••••{emp.bank}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={()=>setEditing(emp)} className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-700"><Edit2 size={14}/></button>
                      <button onClick={()=>setDelConfirm(emp)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">No employees found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showAdd} onClose={()=>setShowAdd(false)} title="Add New Employee" wide>
        <EmployeeForm onSave={addEmp} onClose={()=>setShowAdd(false)}/>
      </Modal>
      <Modal isOpen={!!editing} onClose={()=>setEditing(null)} title="Edit Employee" wide>
        {editing && <EmployeeForm initial={{...editing}} onSave={updateEmp} onClose={()=>setEditing(null)}/>}
      </Modal>
      <Modal isOpen={!!delConfirm} onClose={()=>setDelConfirm(null)} title="Confirm Delete">
        {delConfirm && (
          <div className="space-y-4">
            <p className="text-gray-600">Are you sure you want to remove <strong>{delConfirm.name}</strong>? This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={()=>setDelConfirm(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
              <button onClick={()=>deleteEmp(delConfirm.id)} className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600">Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// Map stored employment type → display label
function empTypeLabel(type) {
  const m = {
    'Regular':      'Full-Time',
    'Full-Time':    'Full-Time',
    'Probationary': 'Full-Time',   // probationary are full-time employees on trial
    'Part-Time':    'Part-Time',
    'Contractor':   'Contractual',
    'Project-Based':'Project-Based',
  };
  return m[type] || type || '—';
}

// ─────────────────────────────────────────────────────────────
// PAYSLIP MODAL
// ─────────────────────────────────────────────────────────────
function PayslipModal({ payslip, employee, runPeriod, releaseDateLabel, otEntries, onClose }) {
  if (!payslip || !employee) return null;
  const slipRef = useRef();
  const [downloading, setDownloading] = useState(false);

  // OT entries for this employee, grouped by type
  const empOT = useMemo(() => {
    if (!otEntries?.length) return [];
    return otEntries.filter(e => e.employeeId === employee.id);
  }, [otEntries, employee.id]);

  const otByType = useMemo(() => {
    const m = {};
    empOT.forEach(e => {
      const key = e.otType;
      if (!m[key]) m[key] = { otType: key, hours: 0, otPay: 0, ndHours: 0, ndPay: 0 };
      m[key].hours   += e.hours?.otHours || 0;
      m[key].otPay   += e.pay?.totalOTPay || 0;
      m[key].ndHours += e.hours?.ndHours || 0;
      m[key].ndPay   += e.pay?.ndPay || 0;
    });
    return Object.values(m);
  }, [empOT]);

  const totalOTPay  = otByType.reduce((s, g) => s + g.otPay,  0);
  const totalNDPay  = otByType.reduce((s, g) => s + g.ndPay,  0);
  const totalNDHrs  = otByType.reduce((s, g) => s + g.ndHours, 0);

  // Gross = base half-salary + adjustments + OT + ND
  const adjustedGross = payslip.grossPay + totalOTPay + totalNDPay;

  // Deductions — always shown; values are 0 on Cut-Off 1
  const isCO1    = payslip.cutOff === 1;
  const sssAmt   = isCO1 ? 0 : (payslip.sss       || 0);
  const phAmt    = isCO1 ? 0 : (payslip.philHealth || 0);
  const hdmfAmt  = isCO1 ? 0 : (payslip.pagIbig    || 0);
  const sssLoan  = payslip.sssLoan  || 0;
  const hdmfLoan = payslip.hdmfLoan || 0;
  const totalDeductions = sssAmt + phAmt + hdmfAmt + sssLoan + hdmfLoan;
  const netPay   = adjustedGross - totalDeductions;

  // ── Download as PNG via html2canvas ──
  const downloadImage = async () => {
    setDownloading(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(slipRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const link = document.createElement('a');
      link.download = `Payslip_${employee.name.replace(/\s+/g,'_')}_${runPeriod.replace(/[\s,–]+/g,'_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch(e) { console.error(e); }
    setDownloading(false);
  };

  // Reusable row helpers
  const Row = ({ label, value, color='text-gray-700', indent=false, bold=false }) => (
    <div className={`flex justify-between items-baseline py-1.5 border-b border-gray-50 last:border-0 ${indent ? 'pl-5' : ''}`}>
      <span className={`text-sm ${indent ? 'text-gray-400' : 'text-gray-600'} ${bold ? 'font-bold text-gray-800' : ''}`}>{label}</span>
      <span className={`text-sm tabular-nums ${color} ${bold ? 'font-bold' : 'font-medium'}`}>{value}</span>
    </div>
  );
  const SectionHead = ({ children, color }) => (
    <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60 flex-shrink-0"/>
      {children}
    </div>
  );

  return (
    <div>
      {/* ══════════════ PAYSLIP CONTENT (captured as image) ══════════════ */}
      <div ref={slipRef} className="bg-white p-6 rounded-xl" style={{fontFamily:'system-ui,sans-serif'}}>

        {/* ── HEADER: Logo left + PAYSLIP right ── */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b-2 border-orange-600">
          {/* Left: Logo + company name */}
          <div className="flex items-center gap-3">
            <img src="/dragonai-logo.png" alt="Dragon AI" className="w-16 h-16 object-contain flex-shrink-0"/>
            <div>
              <p className="font-bold text-gray-800 text-sm leading-tight">Dragon AI Media Inc.</p>
              <p className="text-xs text-gray-400 mt-0.5">Payroll Management System</p>
            </div>
          </div>
          {/* Right: PAYSLIP title + dates */}
          <div className="text-right">
            <h1 className="text-2xl font-black text-orange-700 tracking-widest uppercase">Payslip</h1>
            <p className="text-xs text-gray-500 mt-1">
              <span className="font-semibold text-gray-700">Cut-Off:</span> {runPeriod}
            </p>
            <p className="text-xs text-gray-500">
              <span className="font-semibold text-gray-700">Release:</span> {releaseDateLabel || '—'}
            </p>
          </div>
        </div>

        {/* ── EMPLOYEE INFO ── */}
        <div className="rounded-xl mb-4 px-5 py-3.5 flex items-center justify-between" style={{background:'#c2410c'}}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-white font-black text-base flex-shrink-0">
              {employee.name.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-white text-base leading-tight">{employee.name}</p>
              <p className="text-orange-200 text-xs mt-0.5">{employee.position}</p>
              <p className="text-orange-200 text-xs">{employee.dept} · {empTypeLabel(employee.type)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-orange-200 text-[10px] uppercase tracking-wide font-medium">Monthly Salary</p>
            <p className="font-black text-white text-lg tabular-nums">{fmt(employee.salary || 0)}</p>
            <p className="text-orange-200 text-xs mt-0.5">Bank: ••••{employee.bank}</p>
          </div>
        </div>

        {/* ── EARNINGS + DEDUCTIONS ── */}
        <div className="grid grid-cols-2 gap-4 mb-4">

          {/* EARNINGS */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <SectionHead color="bg-emerald-50 text-emerald-800 border-b border-emerald-100">Earnings</SectionHead>
            <div className="px-4 py-2">

              <Row label="Basic Salary (½ month)" value={fmt(payslip.baseSalary)}/>

              {/* Attendance block */}
              <Row
                label={`Days Attended`}
                value={`${payslip.daysAttended ?? (payslip.workingDays - payslip.absences)} / ${payslip.workingDays || 11}`}/>
              {payslip.absences > 0 && (
                <Row label={`Absences (${payslip.absences}d)`} value={`-${fmt(payslip.absenceDeduct)}`} color="text-red-500" indent/>
              )}
              {payslip.lateMinutes > 0 && (
                <Row label={`Lates (${payslip.lateMinutes} min)`} value={`-${fmt(payslip.lateDeduct)}`} color="text-red-500" indent/>
              )}

              {/* OT by type */}
              {otByType.map(g => {
                const typeInfo = OT_TYPES.find(t => t.id === g.otType);
                return (
                  <div key={g.otType}>
                    <Row label={`${typeInfo?.label || g.otType} (${g.hours.toFixed(2)} hrs)`}
                      value={`+${fmt(g.otPay)}`} color="text-emerald-600"/>
                    {g.ndHours > 0 && (
                      <Row label={`Night Differential (${g.ndHours.toFixed(2)} hrs)`}
                        value={`+${fmt(g.ndPay)}`} color="text-emerald-600" indent/>
                    )}
                  </div>
                );
              })}

              {/* Fallback OT from payslip calc (no OT entries logged) */}
              {otByType.length === 0 && payslip.overtimePay > 0 && (
                <Row label={`Overtime (${payslip.overtime}h)`} value={`+${fmt(payslip.overtimePay)}`} color="text-emerald-600"/>
              )}

              {/* Other earnings */}
              {payslip.allowance > 0 && (
                <Row label="Allowance" value={`+${fmt(payslip.allowance)}`} color="text-emerald-600"/>
              )}
              {payslip.reimbursement > 0 && (
                <Row label="Reimbursement" value={`+${fmt(payslip.reimbursement)}`} color="text-emerald-600"/>
              )}

              <div className="border-t border-gray-200 mt-1 pt-2">
                <Row label="Gross Salary" value={fmt(adjustedGross)} color="text-emerald-700" bold/>
              </div>
            </div>
          </div>

          {/* DEDUCTIONS — always show all rows; 0.00 when CO1 */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <SectionHead color="bg-red-50 text-red-800 border-b border-red-100">Deductions</SectionHead>
            <div className="px-4 py-2">
              <Row label="SSS"
                value={sssAmt > 0 ? `-${fmt(sssAmt)}` : '₱0.00'}
                color={sssAmt > 0 ? 'text-red-500' : 'text-gray-300'}/>
              <Row label="HDMF (Pag-IBIG)"
                value={hdmfAmt > 0 ? `-${fmt(hdmfAmt)}` : '₱0.00'}
                color={hdmfAmt > 0 ? 'text-red-500' : 'text-gray-300'}/>
              <Row label="PhilHealth"
                value={phAmt > 0 ? `-${fmt(phAmt)}` : '₱0.00'}
                color={phAmt > 0 ? 'text-red-500' : 'text-gray-300'}/>
              <Row label="SSS Loan"
                value={sssLoan > 0 ? `-${fmt(sssLoan)}` : '₱0.00'}
                color={sssLoan > 0 ? 'text-red-500' : 'text-gray-300'}/>
              <Row label="HDMF Loan"
                value={hdmfLoan > 0 ? `-${fmt(hdmfLoan)}` : '₱0.00'}
                color={hdmfLoan > 0 ? 'text-red-500' : 'text-gray-300'}/>
              <div className="border-t border-gray-200 mt-1 pt-2">
                <Row label="Total Deductions"
                  value={totalDeductions > 0 ? `-${fmt(totalDeductions)}` : '₱0.00'}
                  color={totalDeductions > 0 ? 'text-red-600' : 'text-gray-300'}
                  bold/>
              </div>
            </div>
          </div>
        </div>

        {/* ── NET PAY ── */}
        <div className="rounded-xl flex items-center justify-between px-5 py-4" style={{background:'#c2410c'}}>
          <div>
            <p className="text-orange-200 text-[10px] uppercase tracking-widest font-semibold">Net Pay</p>
            <p className="text-3xl font-black text-white tabular-nums mt-0.5">{fmt(netPay)}</p>
          </div>
          <div className="text-right text-sm space-y-0.5">
            <p className="text-white/60 text-xs">Gross Salary: <span className="text-white font-semibold">{fmt(adjustedGross)}</span></p>
            <p className="text-white/60 text-xs">Total Deductions: <span className="text-white font-semibold">{totalDeductions > 0 ? `-${fmt(totalDeductions)}` : '₱0.00'}</span></p>
          </div>
        </div>

        {/* Footer note */}
        <p className="text-center text-[10px] text-gray-300 mt-4">
          System-generated payslip · Dragon AI Media Inc. · {new Date().toLocaleDateString('en-PH',{year:'numeric',month:'long',day:'numeric'})}
        </p>
      </div>

      {/* ── ACTION BUTTONS (outside the captured area) ── */}
      <div className="flex gap-3 pt-4 border-t border-gray-100 mt-4">
        <button onClick={downloadImage} disabled={downloading}
          className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 font-medium text-gray-700 disabled:opacity-60">
          {downloading
            ? <><RefreshCw size={14} className="animate-spin"/> Generating…</>
            : <><Download size={14}/> Download as Image</>}
        </button>
        <button onClick={onClose}
          className="ml-auto px-5 py-2 text-sm rounded-lg font-medium text-white hover:bg-orange-800"
          style={{background:'#c2410c'}}>
          Close
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PAYROLL PROCESSING PAGE  (Bi-Monthly Cut-Off Schedule)
// ─────────────────────────────────────────────────────────────
function PayrollProcessing() {
  const { state, dispatch } = useApp();
  const now = new Date();

  // Selectors
  const [selYear,   setSelYear]   = useState(now.getFullYear());
  const [selMonth,  setSelMonth]  = useState(now.getMonth() + 1); // 1-based
  const [selCutOff, setSelCutOff] = useState(1);                  // 1 or 2

  const [processing,     setProcessing]     = useState(false);
  const [preview,        setPreview]        = useState(null);
  const [selectedPayslip,setSelectedPayslip]= useState(null);

  // Derive schedule whenever month/year changes
  const schedule = useMemo(() => getCutOffSchedule(selYear, selMonth), [selYear, selMonth]);
  const activeCO = selCutOff === 1 ? schedule.cutOff1 : schedule.cutOff2;

  // Reset preview when selection changes
  useEffect(() => { setPreview(null); }, [selYear, selMonth, selCutOff]);

  const attendanceMap = useMemo(() => {
    const m = {};
    state.attendance.forEach(a => {
      if (!m[a.employeeId]) m[a.employeeId] = { absences:0, lateMinutes:0 };
      if (a.type==='Absent') m[a.employeeId].absences++;
      else m[a.employeeId].lateMinutes += a.minutes||0;
    });
    return m;
  }, [state.attendance]);

  const buildPreview = () => {
    const rows = state.employees.map(emp => {
      const att  = attendanceMap[emp.id] || {};
      const calc = calcPayslip(emp, 11, att.absences||0, att.lateMinutes||0, 0, selCutOff);
      return { emp, calc };
    });
    setPreview(rows);
  };

  const runPayroll = () => {
    if (!preview) return;
    // Check for duplicate run
    const duplicate = state.payrollRuns.find(r => r.period === activeCO.periodLabel);
    if (duplicate) {
      toast(dispatch, `"${activeCO.periodLabel}" has already been processed.`, 'error');
      return;
    }
    setProcessing(true);
    setTimeout(() => {
      const payslips = preview.map(({ emp, calc }) => ({
        id: uid(), employeeId: emp.id, ...calc,
        period: activeCO.periodLabel, date: activeCO.endDate, status: 'Paid',
      }));
      dispatch({
        type: 'ADD_PAYROLL_RUN',
        payload: {
          id:               uid(),
          period:           activeCO.periodLabel,
          coverage:         activeCO.coverage,
          cutOff:           selCutOff,
          frequency:        'Bi-Monthly',
          startDate:        activeCO.startDate,
          date:             activeCO.endDate,
          releaseDate:      activeCO.releaseDate,
          releaseDateLabel: activeCO.releaseDateLabel,
          status:           'Paid',
          payslips,
        },
      });
      toast(dispatch, `Payroll for "${activeCO.periodLabel}" processed — Release: ${activeCO.releaseDateLabel}`);
      setProcessing(false);
      setPreview(null);
    }, 2000);
  };

  const totalGross  = preview ? preview.reduce((s,r)=>s+r.calc.grossPay,0) : 0;
  const totalNet    = preview ? preview.reduce((s,r)=>s+r.calc.netPay,0)   : 0;
  const totalDeduct = preview ? preview.reduce((s,r)=>s+r.calc.totalDeductions,0) : 0;

  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Run Payroll</h1>
        <p className="text-sm text-gray-500">Bi-Monthly Cut-Off Schedule — select a month to view both cut-off periods</p>
      </div>

      {/* ── Month / Year Selector ── */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Calendar size={16} className="text-orange-600"/> Select Payroll Month
        </h3>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
            <select value={selMonth} onChange={e=>setSelMonth(+e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 min-w-36">
              {MONTH_NAMES.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
            <select value={selYear} onChange={e=>setSelYear(+e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50">
              {yearOptions.map(y=><option key={y}>{y}</option>)}
            </select>
          </div>
          {schedule.isLeap && (
            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 px-3 py-1.5 rounded-lg font-medium">
              📅 Leap Year — Feb ends on the 29th
            </span>
          )}
        </div>
      </div>

      {/* ── Cut-Off Schedule Summary ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
          Cut-Off Schedule — {schedule.monthName} {schedule.year}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[schedule.cutOff1, schedule.cutOff2].map(co => {
            const isActive  = selCutOff === co.num;
            const alreadyRun = state.payrollRuns.some(r => r.period === co.periodLabel);
            return (
              <button key={co.num} onClick={()=>setSelCutOff(co.num)}
                className={`text-left rounded-2xl p-5 border-2 transition-all shadow-sm
                  ${isActive
                    ? 'border-orange-600 bg-orange-50'
                    : 'border-gray-100 bg-white hover:border-orange-300 hover:bg-orange-50/30'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-base ${isActive ? 'text-orange-800' : 'text-gray-700'}`}>
                      {co.label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-orange-200 text-orange-800' : 'bg-gray-100 text-gray-500'}`}>
                      Cut-Off {co.num}
                    </span>
                  </div>
                  {alreadyRun
                    ? <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><Check size={11}/>Processed</span>
                    : <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Pending</span>}
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar size={13} className="text-gray-400 flex-shrink-0"/>
                    <span className="font-medium">Coverage:</span>
                    <span>{co.coverage}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign size={13} className={`flex-shrink-0 ${isActive?'text-orange-400':'text-gray-400'}`}/>
                    <span className="font-medium text-gray-600">Payroll Release:</span>
                    <span className={`font-bold ${isActive?'text-orange-700':'text-gray-700'}`}>
                      {co.releaseDateLabel}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400 mt-1 pl-5">
                    <span>Start: {fmtDate(co.startDate)}</span>
                    <span>End: {fmtDate(co.endDate)}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Selected Cut-Off Action Bar ── */}
      <div className="bg-orange-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-white">
          <p className="font-semibold">{activeCO.periodLabel}</p>
          <p className="text-orange-200 text-xs mt-0.5">
            Coverage: {activeCO.coverage} &nbsp;|&nbsp; Release: {activeCO.releaseDateLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={buildPreview}
            className="flex items-center gap-2 px-4 py-2 bg-white text-orange-800 rounded-xl text-sm font-semibold hover:bg-orange-50 shadow">
            <Eye size={15}/> Preview
          </button>
        </div>
      </div>

      {/* ── Preview Table ── */}
      {preview && (
        <>
          {/* Cut-off rule banner */}
          <div className={`rounded-xl px-4 py-3 flex items-start gap-3 text-sm border
            ${selCutOff === 1
              ? 'bg-blue-50 border-blue-100 text-blue-700'
              : 'bg-emerald-50 border-emerald-100 text-emerald-700'}`}>
            <AlertCircle size={15} className="mt-0.5 flex-shrink-0"/>
            {selCutOff === 1
              ? <span><strong>{activeCO.label}</strong> — Basic salary ÷ 2 only. No allowances. No government deductions (SSS, PhilHealth, Pag-IBIG, Withholding Tax).</span>
              : <span><strong>{activeCO.label}</strong> — Basic salary ÷ 2 + allowances. Full government deductions applied (SSS, PhilHealth, Pag-IBIG, Withholding Tax).</span>}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <StatCard icon={DollarSign} label="Total Gross Pay"   value={fmt(totalGross)}  color="indigo"/>
            <StatCard icon={TrendingUp} label="Total Deductions"  value={fmt(totalDeduct)} color="amber"/>
            <StatCard icon={DollarSign} label="Total Net Pay"     value={fmt(totalNet)}    color="green"/>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h3 className="font-semibold text-gray-700">{activeCO.periodLabel}</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Coverage: {activeCO.coverage} &nbsp;·&nbsp;
                  Payroll Release: <span className="font-semibold text-orange-700">{activeCO.releaseDateLabel}</span>
                </p>
              </div>
              <button onClick={runPayroll} disabled={processing}
                className="flex items-center gap-2 px-5 py-2 text-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-medium disabled:opacity-60 shadow-sm">
                {processing ? <RefreshCw size={15} className="animate-spin"/> : <Check size={15}/>}
                {processing ? 'Processing…' : 'Confirm & Run Payroll'}
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-3 text-left font-medium">Employee</th>
                    <th className="px-4 py-3 text-left font-medium">Dept</th>
                    <th className="px-4 py-3 text-left font-medium">Basic (÷2)</th>
                    {selCutOff === 2 && <th className="px-4 py-3 text-left font-medium">Allowance</th>}
                    <th className="px-4 py-3 text-left font-medium">Gross Pay</th>
                    <th className="px-4 py-3 text-left font-medium">Absences</th>
                    <th className="px-4 py-3 text-left font-medium">Late</th>
                    {selCutOff === 2 && <th className="px-4 py-3 text-left font-medium">Deductions</th>}
                    <th className="px-4 py-3 text-left font-medium">Net Pay</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {preview.map(({ emp, calc }) => (
                    <tr key={emp.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-800">{emp.name}</td>
                      <td className="px-4 py-3 text-gray-500">{emp.dept}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{fmt(calc.baseSalary)}</td>
                      {selCutOff === 2 && (
                        <td className="px-4 py-3 text-emerald-600">
                          {calc.allowance > 0 ? `+${fmt(calc.allowance)}` : <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      <td className="px-4 py-3 text-emerald-600 font-medium">{fmt(calc.grossPay)}</td>
                      <td className="px-4 py-3 text-center">{calc.absences>0?<span className="text-red-500">{calc.absences}d</span>:<span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-center">{calc.lateMinutes>0?<span className="text-yellow-500">{calc.lateMinutes}m</span>:<span className="text-gray-300">—</span>}</td>
                      {selCutOff === 2 && (
                        <td className="px-4 py-3 text-red-500">{fmt(calc.totalDeductions)}</td>
                      )}
                      <td className="px-4 py-3 font-bold text-orange-800">{fmt(calc.netPay)}</td>
                      <td className="px-4 py-3">
                        <button onClick={()=>setSelectedPayslip({payslip:{...calc,period:activeCO.periodLabel,date:activeCO.endDate,status:'Pending'},emp})}
                          className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-700"><Eye size={14}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal isOpen={!!selectedPayslip} onClose={()=>setSelectedPayslip(null)} title="Payslip Preview" wide>
        {selectedPayslip && (
          <PayslipModal
            payslip={selectedPayslip.payslip}
            employee={selectedPayslip.emp}
            runPeriod={activeCO.periodLabel}
            releaseDateLabel={activeCO.releaseDateLabel}
            cutOffDates={activeCO.coverage}
            otEntries={state.otEntries.filter(e =>
              e.date >= activeCO.startDate && e.date <= activeCO.endDate
            )}
            onClose={()=>setSelectedPayslip(null)}
          />
        )}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ATTENDANCE & LEAVE
// ─────────────────────────────────────────────────────────────
function AttendanceLeave() {
  const { state, dispatch } = useApp();
  const [form, setForm] = useState({ employeeId:'', date: today(), type:'Absent', minutes:0, reason:'' });
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const filtered = useMemo(() => state.attendance.filter(a => {
    const emp = state.employees.find(e=>e.id===a.employeeId);
    return !search || (emp && emp.name.toLowerCase().includes(search.toLowerCase()));
  }), [state.attendance, state.employees, search]);

  const empMap = useMemo(() => Object.fromEntries(state.employees.map(e=>[e.id,e])), [state.employees]);

  const save = () => {
    if (!form.employeeId) { toast(dispatch,'Select an employee','error'); return; }
    dispatch({ type:'ADD_ATTENDANCE', payload:{ id:uid(), ...form, minutes:+form.minutes } });
    toast(dispatch,'Attendance record added');
    setShowForm(false);
    setForm({ employeeId:'', date:today(), type:'Absent', minutes:0, reason:'' });
  };

  const summary = useMemo(() => {
    const m = {};
    state.employees.forEach(e => { m[e.id] = { absences:0, lateMinutes:0 }; });
    state.attendance.forEach(a => {
      if (!m[a.employeeId]) m[a.employeeId] = { absences:0, lateMinutes:0 };
      if (a.type==='Absent') m[a.employeeId].absences++;
      else m[a.employeeId].lateMinutes += a.minutes||0;
    });
    return m;
  }, [state.attendance, state.employees]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Attendance & Leave</h1>
          <p className="text-sm text-gray-500">{state.attendance.length} records logged</p>
        </div>
        <button onClick={()=>setShowForm(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-700 text-white rounded-xl text-sm font-medium hover:bg-orange-800">
          <Plus size={16}/> Log Record
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {state.employees.slice(0,4).map(emp => (
          <div key={emp.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="font-medium text-gray-800 text-sm truncate">{emp.name}</p>
            <p className="text-xs text-gray-400 mb-2">{emp.dept}</p>
            <div className="flex gap-3 text-xs">
              <span className="text-red-500 font-medium">{summary[emp.id]?.absences||0} absent</span>
              <span className="text-yellow-500 font-medium">{summary[emp.id]?.lateMinutes||0}m late</span>
            </div>
          </div>
        ))}
      </div>

      {/* Logs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-700 flex-1">Attendance Logs</h3>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employee…"
              className="pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50"/>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                {['Employee','Department','Date','Type','Minutes/Details','Reason',''].map(h=>(
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(rec => {
                const emp = empMap[rec.employeeId];
                return (
                  <tr key={rec.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-800">{emp?.name||rec.employeeId}</td>
                    <td className="px-4 py-3 text-gray-500">{emp?.dept||'—'}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(rec.date)}</td>
                    <td className="px-4 py-3"><Badge status={rec.type}/></td>
                    <td className="px-4 py-3 text-gray-600">
                      {rec.type==='Late' ? `${rec.minutes} minutes late` : 'Full day absent'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{rec.reason||'—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={()=>{dispatch({type:'DELETE_ATTENDANCE',id:rec.id});toast(dispatch,'Record removed','warning');}}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14}/></button>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showForm} onClose={()=>setShowForm(false)} title="Log Attendance / Leave">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Employee</label>
            <select value={form.employeeId} onChange={e=>setForm(p=>({...p,employeeId:e.target.value}))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50">
              <option value="">— Select Employee —</option>
              {state.employees.map(e=><option key={e.id} value={e.id}>{e.name} ({e.dept})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50">
                <option>Absent</option><option>Late</option>
              </select>
            </div>
          </div>
          {form.type==='Late' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Minutes Late</label>
              <input type="number" value={form.minutes} onChange={e=>setForm(p=>({...p,minutes:e.target.value}))} min={1} max={480}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50"/>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
            <input value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))} placeholder="Optional note"
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50"/>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button onClick={()=>setShowForm(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
            <button onClick={save} className="px-5 py-2 text-sm rounded-lg bg-orange-700 text-white hover:bg-orange-800 font-medium">Save Record</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PAYROLL HISTORY
// ─────────────────────────────────────────────────────────────
function PayrollHistory() {
  const { state, dispatch } = useApp();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [runFilter, setRunFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);
  const [viewPayslip, setViewPayslip] = useState(null);

  const empMap = useMemo(() => Object.fromEntries(state.employees.map(e=>[e.id,e])), [state.employees]);

  const filteredRuns = useMemo(() =>
    state.payrollRuns.filter(r => !runFilter || runFilter==='all' || r.id===runFilter)
  , [state.payrollRuns, runFilter]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Payroll History</h1>
          <p className="text-sm text-gray-500">{state.payrollRuns.length} payroll runs</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-2.5 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employee…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50"/>
        </div>
        <select value={deptFilter} onChange={e=>setDeptFilter(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50">
          <option value="All">All Departments</option>{DEPARTMENTS.map(d=><option key={d}>{d}</option>)}
        </select>
        <select value={runFilter} onChange={e=>setRunFilter(e.target.value)} className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50">
          <option value="all">All Runs</option>
          {state.payrollRuns.map(r=><option key={r.id} value={r.id}>{r.period}</option>)}
        </select>
      </div>

      <div className="space-y-3">
        {filteredRuns.map(run => {
          const totalNet = run.payslips.reduce((s,p)=>s+p.netPay,0);
          const totalGross = run.payslips.reduce((s,p)=>s+p.grossPay,0);
          const isOpen = expanded === run.id;
          const filteredPayslips = run.payslips.filter(ps => {
            const emp = empMap[ps.employeeId];
            if (!emp) return false;
            const matchSearch = !search || emp.name.toLowerCase().includes(search.toLowerCase());
            const matchDept = deptFilter==='All' || emp.dept===deptFilter;
            return matchSearch && matchDept;
          });
          return (
            <div key={run.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <button className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors text-left"
                onClick={()=>setExpanded(isOpen ? null : run.id)}>
                <div className="flex-1 flex items-center gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold text-gray-800">{run.period}</p>
                    <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-gray-400">
                      {run.coverage && <span>📅 {run.coverage}</span>}
                      {run.releaseDateLabel && <span>💳 Release: <span className="text-orange-600 font-medium">{run.releaseDateLabel}</span></span>}
                      {!run.releaseDateLabel && <span>{run.frequency} • {fmtDate(run.date)}</span>}
                    </div>
                  </div>
                  <Badge status={run.status}/>
                  <div className="ml-auto flex gap-6 text-sm">
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Gross</p>
                      <p className="font-semibold text-gray-700">{fmt(totalGross)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Net</p>
                      <p className="font-semibold text-orange-700">{fmt(totalNet)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Employees</p>
                      <p className="font-semibold text-gray-700">{run.payslips.length}</p>
                    </div>
                  </div>
                </div>
                {isOpen ? <ChevronUp size={18} className="text-gray-400 flex-shrink-0"/> : <ChevronDown size={18} className="text-gray-400 flex-shrink-0"/>}
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        {['Employee','Department','Gross Pay','Deductions','Net Pay','Status',''].map(h=>(
                          <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredPayslips.map(ps => {
                        const emp = empMap[ps.employeeId];
                        const isCO1 = (run.cutOff === 1) || (ps.cutOff === 1);
                        return (
                          <tr key={ps.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-medium text-gray-800">{emp?.name||ps.employeeId}</td>
                            <td className="px-4 py-3 text-gray-500">{emp?.dept||'—'}</td>
                            <td className="px-4 py-3 text-gray-700">{fmt(ps.grossPay)}</td>
                            <td className="px-4 py-3">
                              {isCO1
                                ? <span className="text-xs text-gray-400 italic">No deductions (CO1)</span>
                                : <span className="text-red-500">{fmt(ps.totalDeductions)}</span>}
                            </td>
                            <td className="px-4 py-3 font-bold text-orange-700">{fmt(ps.netPay)}</td>
                            <td className="px-4 py-3"><Badge status={ps.status}/></td>
                            <td className="px-4 py-3">
                              <button onClick={()=>setViewPayslip({payslip:ps,emp,period:run.period,releaseDateLabel:run.releaseDateLabel,coverage:run.coverage,startDate:run.startDate,endDate:run.date})}
                                className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-700"><Eye size={14}/></button>
                            </td>
                          </tr>
                        );
                      })}
                      {!filteredPayslips.length && (
                        <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400 text-sm">No matching records.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {!filteredRuns.length && (
          <div className="text-center py-16 text-gray-400">No payroll runs found.</div>
        )}
      </div>

      <Modal isOpen={!!viewPayslip} onClose={()=>setViewPayslip(null)} title="Payslip Detail" wide>
        {viewPayslip && (
          <PayslipModal
            payslip={viewPayslip.payslip}
            employee={viewPayslip.emp}
            runPeriod={viewPayslip.period}
            releaseDateLabel={viewPayslip.releaseDateLabel}
            cutOffDates={viewPayslip.coverage}
            otEntries={state.otEntries.filter(e =>
              e.date >= (viewPayslip.startDate || '') && e.date <= (viewPayslip.endDate || '')
            )}
            onClose={()=>setViewPayslip(null)}
          />
        )}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────
function Dashboard() {
  const { state } = useApp();

  const latestRun = state.payrollRuns[0];
  const prevRun   = state.payrollRuns[1];

  const empMap = useMemo(() => Object.fromEntries(state.employees.map(e=>[e.id,e])), [state.employees]);

  const latestTotal = latestRun ? latestRun.payslips.reduce((s,p)=>s+p.netPay,0) : 0;
  const prevTotal   = prevRun   ? prevRun.payslips.reduce((s,p)=>s+p.netPay,0)   : 0;
  const trendPct    = prevTotal ? Math.round((latestTotal-prevTotal)/prevTotal*100) : 0;

  const headcountByDept = useMemo(() => DEPARTMENTS.map(d => ({
    dept: d, count: state.employees.filter(e=>e.dept===d).length
  })), [state.employees]);

  const payrollByDept = useMemo(() => {
    if (!latestRun) return [];
    const map = {};
    latestRun.payslips.forEach(ps => {
      const emp = empMap[ps.employeeId];
      if (!emp) return;
      if (!map[emp.dept]) map[emp.dept] = 0;
      map[emp.dept] += ps.grossPay;
    });
    return DEPARTMENTS.map(d => ({ dept: d, value: map[d]||0 }));
  }, [latestRun, empMap]);

  const trendData = useMemo(() => [...state.payrollRuns].reverse().map(r => ({
    period: r.period.split(' ')[0],
    gross: r.payslips.reduce((s,p)=>s+p.grossPay,0),
    net:   r.payslips.reduce((s,p)=>s+p.netPay,0),
  })), [state.payrollRuns]);

  const deductBreakdown = useMemo(() => {
    if (!latestRun) return [];
    const totals = { SSS:0, PhilHealth:0, 'Pag-IBIG':0, Tax:0 };
    latestRun.payslips.forEach(p => {
      totals.SSS       += p.sss||0;
      totals.PhilHealth+= p.philHealth||0;
      totals['Pag-IBIG']+= p.pagIbig||0;
      totals.Tax       += p.tax||0;
    });
    return Object.entries(totals).map(([name,value])=>({name,value}));
  }, [latestRun]);

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-500">Overview for {latestRun?.period || 'this period'}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}       label="Total Employees" value={state.employees.length} sub={`${state.employees.filter(e=>e.type==='Full-Time').length} full-time`} color="indigo"/>
        <StatCard icon={DollarSign}  label="Latest Net Payroll" value={fmt(latestTotal)} sub={latestRun?.period} trend={trendPct} color="green"/>
        <StatCard icon={FileText}    label="Payroll Runs" value={state.payrollRuns.length} sub="total runs" color="amber"/>
        <StatCard icon={Clock}       label="Attendance Logs" value={state.attendance.length} sub="this period" color="pink"/>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Payroll trend */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-4">Payroll Trend</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="period" tick={{fontSize:11}} tickLine={false}/>
              <YAxis tickFormatter={v=>`₱${(v/1000).toFixed(0)}k`} tick={{fontSize:11}} tickLine={false} axisLine={false}/>
              <Tooltip formatter={(v)=>[fmt(v)]} contentStyle={{borderRadius:8,fontSize:12,border:'1px solid #e2e8f0'}}/>
              <Legend/>
              <Line type="monotone" dataKey="gross" name="Gross" stroke="#c2410c" strokeWidth={2} dot={false}/>
              <Line type="monotone" dataKey="net"   name="Net"   stroke="#10b981" strokeWidth={2} dot={false}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Deduction breakdown */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-4">Deduction Breakdown</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={deductBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3}>
                {deductBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
              </Pie>
              <Tooltip formatter={(v)=>[fmt(v)]} contentStyle={{borderRadius:8,fontSize:12}}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-2">
            {deductBreakdown.map((d,i)=>(
              <div key={d.name} className="flex items-center gap-1 text-xs text-gray-500">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{background:CHART_COLORS[i]}}/>
                {d.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Dept payroll */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-4">Payroll by Department</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={payrollByDept} margin={{top:0,right:0,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
              <XAxis dataKey="dept" tick={{fontSize:11}} tickLine={false}/>
              <YAxis tickFormatter={v=>`₱${(v/1000).toFixed(0)}k`} tick={{fontSize:11}} tickLine={false} axisLine={false}/>
              <Tooltip formatter={(v)=>[fmt(v),'Gross']} contentStyle={{borderRadius:8,fontSize:12}}/>
              <Bar dataKey="value" radius={[6,6,0,0]}>
                {payrollByDept.map((d,i)=><Cell key={i} fill={DEPT_COLORS[d.dept]||CHART_COLORS[i]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Headcount */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-4">Headcount by Department</h3>
          <div className="space-y-3 mt-2">
            {headcountByDept.map(({ dept, count }) => (
              <div key={dept}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 font-medium">{dept}</span>
                  <span className="text-gray-500">{count} employees</span>
                </div>
                <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{width:`${(count/state.employees.length)*100}%`, background: DEPT_COLORS[dept]}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent payroll runs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-700">Recent Payroll Runs</div>
        <div className="divide-y divide-gray-50">
          {state.payrollRuns.slice(0,5).map(run => (
            <div key={run.id} className="flex items-center gap-4 px-5 py-3">
              <div className="flex-1">
                <p className="font-medium text-gray-800 text-sm">{run.period}</p>
                <p className="text-xs text-gray-400">{run.frequency} • {fmtDate(run.date)}</p>
              </div>
              <Badge status={run.status}/>
              <p className="font-semibold text-orange-700 text-sm">{fmt(run.payslips.reduce((s,p)=>s+p.netPay,0))}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// REPORTS PAGE
// ─────────────────────────────────────────────────────────────
function Reports() {
  const { state } = useApp();
  const empMap = useMemo(() => Object.fromEntries(state.employees.map(e=>[e.id,e])), [state.employees]);
  const [activeTab, setActiveTab] = useState('summary');

  const deptSummary = useMemo(() => {
    const map = {};
    DEPARTMENTS.forEach(d => { map[d] = { dept:d, headcount:0, totalSalary:0, totalNet:0, totalTax:0 }; });
    state.employees.forEach(e => {
      if (map[e.dept]) { map[e.dept].headcount++; map[e.dept].totalSalary += e.salary; }
    });
    state.payrollRuns.slice(0,1).forEach(run => {
      run.payslips.forEach(ps => {
        const emp = empMap[ps.employeeId];
        if (emp && map[emp.dept]) {
          map[emp.dept].totalNet += ps.netPay;
          map[emp.dept].totalTax += ps.tax||0;
        }
      });
    });
    return Object.values(map);
  }, [state.employees, state.payrollRuns, empMap]);

  const empSummary = useMemo(() => state.employees.map(emp => {
    const allPayslips = state.payrollRuns.flatMap(r => r.payslips.filter(p=>p.employeeId===emp.id));
    const ytdGross = allPayslips.reduce((s,p)=>s+p.grossPay,0);
    const ytdNet   = allPayslips.reduce((s,p)=>s+p.netPay,0);
    const ytdTax   = allPayslips.reduce((s,p)=>s+(p.tax||0),0);
    return { emp, ytdGross, ytdNet, ytdTax, runs: allPayslips.length };
  }), [state.employees, state.payrollRuns]);

  const tabs = [
    { id:'summary', label:'Department Summary' },
    { id:'employee', label:'Employee YTD' },
  ];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
        <p className="text-sm text-gray-500">Payroll analytics and summaries</p>
      </div>

      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${activeTab===t.id ? 'bg-white shadow-sm text-orange-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab==='summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {deptSummary.map(d => (
              <div key={d.dept} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{background:DEPT_COLORS[d.dept]}}/>
                  <span className="font-medium text-gray-700 text-sm">{d.dept}</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{d.headcount}</p>
                <p className="text-xs text-gray-400 mt-0.5">employees</p>
                <div className="mt-3 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-gray-400">Total Salary</span><span className="font-medium">{fmt(d.totalSalary)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Last Net Pay</span><span className="font-medium text-orange-700">{fmt(d.totalNet)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Total Tax</span><span className="font-medium text-red-500">{fmt(d.totalTax)}</span></div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-gray-700 mb-4">Department Salary Comparison</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={deptSummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="dept" tick={{fontSize:12}} tickLine={false}/>
                <YAxis tickFormatter={v=>`₱${(v/1000).toFixed(0)}k`} tick={{fontSize:11}} tickLine={false} axisLine={false}/>
                <Tooltip formatter={(v,n)=>[fmt(v),n==='totalSalary'?'Total Salary':n==='totalNet'?'Net Pay':'Tax']}
                  contentStyle={{borderRadius:8,fontSize:12}}/>
                <Legend/>
                <Bar dataKey="totalSalary" name="Total Salary" fill="#c2410c" radius={[4,4,0,0]}/>
                <Bar dataKey="totalNet"    name="Net Pay"      fill="#10b981" radius={[4,4,0,0]}/>
                <Bar dataKey="totalTax"    name="Tax"          fill="#f59e0b" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab==='employee' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  {['Employee','Department','Type','Base Salary','YTD Gross','YTD Net','YTD Tax','Runs'].map(h=>(
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {empSummary.map(({ emp, ytdGross, ytdNet, ytdTax, runs }) => (
                  <tr key={emp.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-800">{emp.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{background:DEPT_COLORS[emp.dept]+'22',color:DEPT_COLORS[emp.dept]}}>
                        {emp.dept}
                      </span>
                    </td>
                    <td className="px-4 py-3"><Badge status={emp.type}/></td>
                    <td className="px-4 py-3 text-gray-700">{fmt(emp.salary)}</td>
                    <td className="px-4 py-3 text-gray-700">{fmt(ytdGross)}</td>
                    <td className="px-4 py-3 font-medium text-orange-700">{fmt(ytdNet)}</td>
                    <td className="px-4 py-3 text-red-500">{fmt(ytdTax)}</td>
                    <td className="px-4 py-3 text-gray-500">{runs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// OT ENTRY FORM
// ─────────────────────────────────────────────────────────────
function OTEntryForm({ initial, onSave, onClose, employees }) {
  const [form, setForm] = useState(initial || {
    id: uid(), employeeId:'', date: today(),
    otType:'regular', timeIn:'18:00', timeOut:'20:00', dailyRate:'',
  });
  const [errs, setErrs] = useState({});
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Auto-fill daily rate when employee changes
  useEffect(() => {
    if (!form.employeeId || initial) return;
    const emp = employees.find(e => e.id === form.employeeId);
    if (emp && emp.salary > 0) f('dailyRate', (emp.salary / 22).toFixed(2));
  }, [form.employeeId]);

  // Auto-suggest OT type based on date (holiday > rest day > regular)
  useEffect(() => {
    if (!form.date || initial) return;
    f('otType', autoOTType(form.date));
  }, [form.date]);

  // Live computed values
  const hours = useMemo(() => calcOTHours(form.timeIn, form.timeOut, form.date), [form.timeIn, form.timeOut, form.date]);
  const pay   = useMemo(() => calcOTPay(+form.dailyRate || 0, hours, form.otType), [form.dailyRate, hours, form.otType]);
  const dayInfo  = hours.dayInfo || getDaySchedule(form.date);
  const holiday  = PH_HOLIDAYS[form.date] || null;

  const validate = () => {
    const e = {};
    if (!form.employeeId)                        e.employeeId = 'Select an employee';
    if (!form.timeIn)                            e.timeIn     = 'Required';
    if (!form.timeOut)                           e.timeOut    = 'Required';
    if (!form.dailyRate || +form.dailyRate <= 0) e.dailyRate  = 'Enter daily rate';
    if (hours.otHours === 0 && !dayInfo.isRestDay) e.timeOut  = 'No OT detected — work must extend past regular schedule end, minimum 30 minutes';
    setErrs(e); return !Object.keys(e).length;
  };

  const submit = () => {
    if (validate()) onSave({ ...form, hours, pay, hasND: hours.ndHours > 0 });
  };

  const fieldCls = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  const otBelowMin = hours.otMins > 0 && hours.otMins < OT_MIN_MINUTES;

  return (
    <div className="space-y-4">

      {/* Schedule Info Banner */}
      {form.date && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl text-sm border
          ${holiday ? (holiday.type === 'reghol' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-teal-50 border-teal-200 text-teal-700')
            : dayInfo.isRestDay ? 'bg-orange-50 border-orange-200 text-orange-700'
            : 'bg-orange-50 border-orange-100 text-orange-800'}`}>
          <Calendar size={15} className="mt-0.5 flex-shrink-0"/>
          <div>
            <span className="font-semibold">{dayInfo.dayName}</span>
            {holiday
              ? <span className="ml-1">— 📅 <strong>{holiday.name}</strong> ({holiday.type === 'reghol' ? 'Regular Holiday' : 'Special Non-Working Holiday'})</span>
              : <span>{' — '}{dayInfo.label}</span>
            }
            {!dayInfo.isRestDay && !holiday && (
              <span className="ml-1 text-xs opacity-70">
                · OT starts after {fmt12h(String(Math.floor(dayInfo.schedEnd/60)).padStart(2,'0')+':'+String(dayInfo.schedEnd%60).padStart(2,'0'))}
                {dayInfo.lunchDeduct && ' · 1-hr lunch auto-deducted when total time > 5 hrs'}
              </span>
            )}
            {(dayInfo.isRestDay || holiday) && <span className="ml-1 text-xs opacity-70">· All hours billed at holiday/rest day rate</span>}
          </div>
        </div>
      )}

      {/* OT below threshold warning */}
      {otBelowMin && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm">
          <AlertCircle size={15}/>
          OT is {hours.otMins} min — below the 30-minute minimum. It will not be counted.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Employee */}
        <div className="col-span-2">
          <label className={labelCls}>Employee</label>
          <select value={form.employeeId} onChange={e=>f('employeeId',e.target.value)} className={fieldCls}>
            <option value="">— Select Employee —</option>
            {employees.map(emp=>(
              <option key={emp.id} value={emp.id}>{emp.name} ({emp.id})</option>
            ))}
          </select>
          {errs.employeeId && <p className="text-xs text-red-500 mt-1">{errs.employeeId}</p>}
        </div>

        {/* Date */}
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" value={form.date} onChange={e=>f('date',e.target.value)} className={fieldCls}/>
        </div>

        {/* OT Type */}
        <div>
          <label className={labelCls}>OT Type <span className="text-gray-400 font-normal">(auto-detected: holiday › rest day › regular)</span></label>
          <select value={form.otType} onChange={e=>f('otType',e.target.value)} className={fieldCls}>
            {OT_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        {/* Time In */}
        <div>
          <label className={labelCls}>Time In</label>
          <input type="time" value={form.timeIn} onChange={e=>f('timeIn',e.target.value)} className={fieldCls}/>
          {errs.timeIn && <p className="text-xs text-red-500 mt-1">{errs.timeIn}</p>}
        </div>

        {/* Time Out */}
        <div>
          <label className={labelCls}>Time Out</label>
          <input type="time" value={form.timeOut} onChange={e=>f('timeOut',e.target.value)} className={fieldCls}/>
          {errs.timeOut && <p className="text-xs text-red-500 mt-1">{errs.timeOut}</p>}
        </div>

        {/* Daily Rate */}
        <div className="col-span-2">
          <label className={labelCls}>Daily Rate (PHP) — auto-filled from employee salary ÷ 22</label>
          <input type="number" value={form.dailyRate} onChange={e=>f('dailyRate',e.target.value)}
            placeholder="e.g. 1136.36" className={fieldCls}/>
          {errs.dailyRate && <p className="text-xs text-red-500 mt-1">{errs.dailyRate}</p>}
        </div>
      </div>

      {/* ND auto-notice */}
      {hours.ndHours > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-50 border border-orange-100 text-orange-800 text-sm">
          <span>🌙</span>
          <span>Night Differential auto-detected: <strong>{hours.ndHours.toFixed(2)} hrs</strong> (10 PM – 6 AM) at +10%</span>
        </div>
      )}

      {/* Computed Preview */}
      <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
        <p className="text-xs font-semibold text-orange-800 uppercase tracking-wide mb-3">Computed Preview</p>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="bg-white rounded-lg p-3 border border-orange-100">
            <p className="text-xs text-gray-400">Total Time</p>
            <p className="font-semibold text-gray-800">{hours.totalHours.toFixed(2)} hrs</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-orange-100">
            <p className="text-xs text-gray-400">Work Hours</p>
            <p className="font-semibold text-gray-800">{hours.workHours.toFixed(2)} hrs</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-orange-100">
            <p className="text-xs text-gray-400">OT Hours</p>
            <p className={`font-semibold ${hours.otHours > 0 ? 'text-orange-700' : 'text-gray-300'}`}>
              {hours.otHours > 0 ? hours.otHours.toFixed(2) + ' hrs' : 'None'}
            </p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-orange-100">
            <p className="text-xs text-gray-400">🌙 ND Hours</p>
            <p className="font-semibold text-gray-800">{hours.ndHours > 0 ? hours.ndHours.toFixed(2) + ' hrs' : '—'}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-orange-100">
            <p className="text-xs text-gray-400">Est. OT Pay</p>
            <p className="font-semibold text-emerald-600">{fmt(pay.totalOTPay)}</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-orange-100">
            <p className="text-xs text-gray-400">Est. ND Pay</p>
            <p className="font-semibold text-emerald-600">{pay.ndPay > 0 ? fmt(pay.ndPay) : '—'}</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-orange-100 flex justify-between items-center">
          <span className="text-sm font-semibold text-orange-900">Estimated Total OT Pay</span>
          <span className="text-xl font-bold text-orange-800">{fmt(pay.total)}</span>
        </div>
      </div>

      <div className="flex gap-3 justify-end pt-1">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
        <button onClick={submit} className="px-5 py-2 text-sm rounded-lg bg-orange-700 text-white hover:bg-orange-800 font-medium">
          {initial ? 'Save Changes' : 'Add OT Entry'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// OT BATCH ENTRY FORM  (multi-day, single employee)
// ─────────────────────────────────────────────────────────────
function OTBatchForm({ initialEmpId, onSaveAll, onClose, employees }) {
  const [empId, setEmpId] = useState(initialEmpId || '');
  const makeRow = () => {
    const d = today();
    return { id: uid(), date: d, otType: autoOTType(d), timeIn: '18:00', timeOut: '20:00' };
  };
  const [rows, setRows] = useState([makeRow()]);
  const [submitted, setSubmitted] = useState(false);

  const emp       = employees.find(e => e.id === empId);
  const dailyRate = emp ? emp.salary / 22 : 0;

  const addRow    = () => setRows(r => [...r, makeRow()]);
  const removeRow = (id) => setRows(r => r.filter(x => x.id !== id));
  const updateRow = (id, key, val) => setRows(r => r.map(x => {
    if (x.id !== id) return x;
    const upd = { ...x, [key]: val };
    if (key === 'date') upd.otType = autoOTType(val);
    return upd;
  }));

  const computed = rows.map(row => {
    const hours   = calcOTHours(row.timeIn, row.timeOut, row.date);
    const pay     = calcOTPay(dailyRate, hours, row.otType);
    const holiday = PH_HOLIDAYS[row.date] || null;
    const dayInfo = hours.dayInfo || getDaySchedule(row.date);
    const otBelowMin = hours.otMins > 0 && hours.otMins < OT_MIN_MINUTES;
    const hasOT  = hours.otHours > 0 || dayInfo.isRestDay;
    return { hours, pay, holiday, dayInfo, otBelowMin, hasOT };
  });

  const totals = computed.reduce((acc, c) => ({
    otHours: acc.otHours + c.hours.otHours,
    ndHours: acc.ndHours + c.hours.ndHours,
    total:   acc.total   + c.pay.total,
  }), { otHours: 0, ndHours: 0, total: 0 });

  const canSave = empId && computed.some(c => c.hasOT);

  const submit = () => {
    setSubmitted(true);
    if (!empId) return;
    const entries = rows.map((row, i) => ({
      id: uid(),
      employeeId: empId,
      date:       row.date,
      otType:     row.otType,
      timeIn:     row.timeIn,
      timeOut:    row.timeOut,
      dailyRate:  String(dailyRate.toFixed(2)),
      hours:      computed[i].hours,
      pay:        computed[i].pay,
      hasND:      computed[i].hours.ndHours > 0,
    })).filter((_, i) => computed[i].hasOT);
    if (!entries.length) return;
    onSaveAll(entries);
  };

  const inputCls = 'px-2 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white';
  const fieldCls = 'px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 w-full';

  return (
    <div className="space-y-4">

      {/* Employee Selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Employee</label>
        <select value={empId} onChange={e => setEmpId(e.target.value)}
          disabled={!!initialEmpId}
          className={`${fieldCls} ${initialEmpId ? 'opacity-60 cursor-not-allowed' : ''}`}>
          <option value="">— Select Employee —</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.id})</option>)}
        </select>
        {submitted && !empId && <p className="text-xs text-red-500 mt-1">Select an employee</p>}
      </div>

      {/* Daily Rate Info */}
      {emp && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-orange-50 border border-orange-100 text-sm text-orange-800">
          <CreditCard size={14}/>
          <span>Daily Rate: <strong>₱{dailyRate.toFixed(2)}</strong></span>
          <span className="text-orange-400">·</span>
          <span className="text-orange-600">₱{emp.salary.toLocaleString()} salary ÷ 22 working days</span>
        </div>
      )}

      {/* OT Rows */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
              <th className="px-3 py-2.5 text-left font-medium">Date</th>
              <th className="px-3 py-2.5 text-left font-medium">Day / Holiday</th>
              <th className="px-3 py-2.5 text-left font-medium">OT Type</th>
              <th className="px-3 py-2.5 text-left font-medium">Time In</th>
              <th className="px-3 py-2.5 text-left font-medium">Time Out</th>
              <th className="px-3 py-2.5 text-center font-medium">OT Hrs</th>
              <th className="px-3 py-2.5 text-center font-medium">🌙 ND</th>
              <th className="px-3 py-2.5 text-right font-medium">Est. Total</th>
              <th className="px-2 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row, i) => {
              const c      = computed[i];
              const otType = OT_TYPES.find(t => t.id === row.otType);
              return (
                <tr key={row.id}
                  className={`${c.otBelowMin ? 'bg-yellow-50/40' : ''} ${!c.hasOT && !c.dayInfo.isRestDay ? 'bg-gray-50/40' : ''}`}>
                  <td className="px-3 py-2">
                    <input type="date" value={row.date}
                      onChange={e => updateRow(row.id, 'date', e.target.value)}
                      className={inputCls}/>
                  </td>
                  <td className="px-3 py-2 min-w-[130px]">
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-xs font-medium ${c.dayInfo.isRestDay ? 'text-orange-600' : 'text-gray-700'}`}>
                        {c.dayInfo.dayName}
                      </span>
                      {c.holiday && (
                        <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap
                          ${c.holiday.type === 'reghol' ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'}`}>
                          📅 {c.holiday.name}
                        </span>
                      )}
                      {!c.holiday && c.dayInfo.isRestDay && (
                        <span className="text-xs text-orange-400">Rest Day</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 min-w-[150px]">
                    <select value={row.otType}
                      onChange={e => updateRow(row.id, 'otType', e.target.value)}
                      className={`${inputCls} text-xs w-full ${otType?.color || ''}`}>
                      {OT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input type="time" value={row.timeIn}
                      onChange={e => updateRow(row.id, 'timeIn', e.target.value)}
                      className={`${inputCls} w-28`}/>
                  </td>
                  <td className="px-3 py-2">
                    <input type="time" value={row.timeOut}
                      onChange={e => updateRow(row.id, 'timeOut', e.target.value)}
                      className={`${inputCls} w-28`}/>
                  </td>
                  <td className="px-3 py-2 text-center font-medium">
                    {c.hours.otHours > 0
                      ? <span className="text-orange-700">{c.hours.otHours.toFixed(2)}</span>
                      : c.otBelowMin
                        ? <span className="text-yellow-500 text-xs">{'<30m'}</span>
                        : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {c.hours.ndHours > 0
                      ? <span className="text-orange-600 text-xs">{c.hours.ndHours.toFixed(2)}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-600 whitespace-nowrap">
                    {c.hasOT
                      ? fmt(c.pay.total)
                      : <span className="text-xs font-normal text-gray-400">No OT</span>}
                  </td>
                  <td className="px-2 py-2">
                    {rows.length > 1 && (
                      <button onClick={() => removeRow(row.id)}
                        className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                        <X size={14}/>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Row */}
      <button onClick={addRow}
        className="flex items-center gap-2 px-4 py-2 text-sm text-orange-700 border border-dashed border-orange-300 rounded-xl hover:bg-orange-50 transition-colors w-full justify-center font-medium">
        <Plus size={15}/> Add Another Date
      </button>

      {/* Totals */}
      {totals.otHours > 0 && (
        <div className="bg-orange-50 border border-orange-100 rounded-xl px-5 py-3 flex items-center justify-between">
          <div className="flex gap-4 text-sm text-orange-800">
            <span><strong>{computed.filter(c => c.hasOT).length}</strong> valid {computed.filter(c => c.hasOT).length === 1 ? 'entry' : 'entries'}</span>
            <span className="text-orange-300">·</span>
            <span>Total OT: <strong>{totals.otHours.toFixed(2)} hrs</strong></span>
            {totals.ndHours > 0 && <>
              <span className="text-orange-300">·</span>
              <span>🌙 ND: <strong>{totals.ndHours.toFixed(2)} hrs</strong></span>
            </>}
          </div>
          <span className="text-lg font-bold text-orange-800">{fmt(totals.total)}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-1">
        <button onClick={onClose}
          className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
        <button onClick={submit} disabled={!canSave}
          className={`px-5 py-2 text-sm rounded-lg font-medium transition-colors
            ${canSave ? 'bg-orange-700 text-white hover:bg-orange-800' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
          Save {computed.filter(c => c.hasOT).length > 1
            ? `${computed.filter(c => c.hasOT).length} Entries`
            : 'Entry'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// OT PROCESSING PAGE
// ─────────────────────────────────────────────────────────────
function OTProcessing() {
  const { state, dispatch } = useApp();
  const now = new Date();
  const [selYear,    setSelYear]    = useState(now.getFullYear());
  const [selMonth,   setSelMonth]   = useState(now.getMonth() + 1);
  const [selCutOff,  setSelCutOff]  = useState(1);
  const [search,     setSearch]     = useState('');
  // batchEmpId: string → open batch form pre-filled for that employee
  // batchEmpId: ''     → open batch form with employee selector
  const [batchEmpId, setBatchEmpId] = useState(null); // null = closed
  const [editing,    setEditing]    = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);
  // which employee cards are expanded
  const [expanded,   setExpanded]   = useState({});

  const schedule  = useMemo(() => getCutOffSchedule(selYear, selMonth), [selYear, selMonth]);
  const activeCO  = selCutOff === 1 ? schedule.cutOff1 : schedule.cutOff2;
  const empMap    = useMemo(() => Object.fromEntries(state.employees.map(e=>[e.id,e])), [state.employees]);
  const yearOpts  = Array.from({ length:5 }, (_,i) => now.getFullYear() - 1 + i);

  // All entries in cut-off window
  const coEntries = useMemo(() =>
    state.otEntries.filter(e => e.date >= activeCO.startDate && e.date <= activeCO.endDate),
    [state.otEntries, activeCO]
  );

  // Group entries by employee
  const byEmployee = useMemo(() => {
    const m = {};
    coEntries.forEach(e => {
      if (!m[e.employeeId]) m[e.employeeId] = [];
      m[e.employeeId].push(e);
    });
    // sort each employee's entries by date asc
    Object.values(m).forEach(arr => arr.sort((a,b) => a.date.localeCompare(b.date)));
    return m;
  }, [coEntries]);

  // Employees who appear in entries OR match search
  const displayEmpIds = useMemo(() => {
    const inEntries = Object.keys(byEmployee);
    if (!search) return inEntries;
    return inEntries.filter(id => {
      const emp = empMap[id];
      return emp && emp.name.toLowerCase().includes(search.toLowerCase());
    });
  }, [byEmployee, search, empMap]);

  // Per-employee totals
  const empTotals = useMemo(() => {
    const m = {};
    Object.entries(byEmployee).forEach(([empId, entries]) => {
      m[empId] = entries.reduce((acc, e) => ({
        otHours: acc.otHours + e.hours.otHours,
        ndHours: acc.ndHours + e.hours.ndHours,
        otPay:   acc.otPay   + e.pay.totalOTPay,
        ndPay:   acc.ndPay   + e.pay.ndPay,
        total:   acc.total   + e.pay.total,
        count:   acc.count   + 1,
      }), { otHours:0, ndHours:0, otPay:0, ndPay:0, total:0, count:0 });
    });
    return m;
  }, [byEmployee]);

  // Grand totals
  const grand = useMemo(() =>
    Object.values(empTotals).reduce((acc, s) => ({
      otHours: acc.otHours + s.otHours,
      ndHours: acc.ndHours + s.ndHours,
      total:   acc.total   + s.total,
    }), { otHours:0, ndHours:0, total:0 }),
  [empTotals]);

  const saveBatch   = (entries) => {
    dispatch({ type:'ADD_OT_ENTRIES', payload:entries });
    const empName = empMap[entries[0]?.employeeId]?.name || '';
    toast(dispatch, `${entries.length} OT ${entries.length===1?'entry':'entries'} saved${empName ? ' for '+empName : ''}`);
    // expand that employee's card
    if (entries[0]?.employeeId) setExpanded(p => ({ ...p, [entries[0].employeeId]: true }));
    setBatchEmpId(null);
  };
  const updateEntry = (entry) => { dispatch({ type:'UPDATE_OT_ENTRY', payload:entry }); toast(dispatch,'OT entry updated'); setEditing(null); };
  const deleteEntry = (id)    => { dispatch({ type:'DELETE_OT_ENTRY', id });             toast(dispatch,'OT entry removed','warning'); setDelConfirm(null); };
  const toggleExpand = (id)   => setExpanded(p => ({ ...p, [id]: !p[id] }));

  const filterCls = 'px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400';

  return (
    <div className="p-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">OT Processing</h1>
          <p className="text-sm text-gray-500">
            {coEntries.length} OT {coEntries.length === 1 ? 'entry' : 'entries'}
            {' · '}{Object.keys(byEmployee).length} {Object.keys(byEmployee).length === 1 ? 'employee' : 'employees'}
            {' · '}{activeCO.coverage}
          </p>
        </div>
        <button onClick={() => setBatchEmpId('')}
          className="flex items-center gap-2 px-4 py-2 bg-orange-700 text-white rounded-xl text-sm font-medium hover:bg-orange-800 shadow-sm">
          <Plus size={16}/> Add OT Entry
        </button>
      </div>

      {/* ── Cut-off selector ── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
          <select value={selMonth} onChange={e=>setSelMonth(+e.target.value)} className={filterCls}>
            {MONTH_NAMES.map((m,i)=><option key={m} value={i+1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
          <select value={selYear} onChange={e=>setSelYear(+e.target.value)} className={filterCls}>
            {yearOpts.map(y=><option key={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          {[schedule.cutOff1, schedule.cutOff2].map(co => (
            <button key={co.num} onClick={()=>setSelCutOff(co.num)}
              className={`px-4 py-2 text-sm rounded-lg font-medium border transition-all
                ${selCutOff===co.num ? 'bg-orange-700 text-white border-orange-700' : 'border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-700'}`}>
              {co.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 ml-1">
          <Calendar size={14} className="text-orange-400"/>
          <span className="font-medium text-orange-700">{activeCO.label}, {selYear}</span>
          <span className="text-gray-300">|</span>
          <span>Release: <span className="font-medium text-gray-700">{activeCO.releaseDateLabel}</span></span>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-2.5 text-gray-400"/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search employee…"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400"/>
      </div>

      {/* ── Employee OT Cards ── */}
      {displayEmpIds.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-16 text-center text-gray-400">
          <Timer size={36} className="mx-auto mb-3 text-gray-200"/>
          <p className="font-medium">No OT entries for {activeCO.coverage}</p>
          <p className="text-sm mt-1">Click "Add OT Entry" to start logging overtime.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayEmpIds.map(empId => {
            const emp     = empMap[empId];
            const entries = byEmployee[empId] || [];
            const totals  = empTotals[empId];
            const isOpen  = !!expanded[empId];
            return (
              <div key={empId} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Employee header row */}
                <div className="flex items-center justify-between px-5 py-4 cursor-pointer select-none hover:bg-gray-50/60"
                  onClick={() => toggleExpand(empId)}>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ background: DEPT_COLORS[emp?.dept] || '#c2410c' }}>
                      {emp?.name?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{emp?.name || empId}</p>
                      <p className="text-xs text-gray-400">{emp?.id} · {emp?.dept}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-4 ml-4 text-sm">
                      <span className="text-gray-500">
                        <span className="font-medium text-gray-700">{totals.count}</span> {totals.count===1?'day':'days'}
                      </span>
                      <span className="text-gray-300">·</span>
                      <span className="text-gray-500">
                        OT: <span className="font-medium text-orange-700">{totals.otHours.toFixed(2)} hrs</span>
                      </span>
                      {totals.ndHours > 0 && <>
                        <span className="text-gray-300">·</span>
                        <span className="text-gray-500">🌙 <span className="font-medium text-orange-600">{totals.ndHours.toFixed(2)} hrs</span></span>
                      </>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-bold text-orange-700 text-base">{fmt(totals.total)}</span>
                    <button
                      onClick={e => { e.stopPropagation(); setBatchEmpId(empId); }}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors"
                      title="Add more OT dates for this employee">
                      <Plus size={12}/> Add OT
                    </button>
                    {isOpen ? <ChevronUp size={16} className="text-gray-400"/> : <ChevronDown size={16} className="text-gray-400"/>}
                  </div>
                </div>

                {/* Entries detail table */}
                {isOpen && (
                  <div className="border-t border-gray-100">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                            {['Date','Day / Holiday','OT Type','Time In','Time Out','OT Hrs','🌙 ND','OT Pay','ND Pay','Total',''].map(h=>(
                              <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {entries.map(entry => {
                            const otType  = OT_TYPES.find(t => t.id === entry.otType);
                            const holiday = PH_HOLIDAYS[entry.date];
                            const dayInfo = entry.hours?.dayInfo || getDaySchedule(entry.date);
                            return (
                              <tr key={entry.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-medium">{fmtDate(entry.date)}</td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-col gap-0.5">
                                    <span className={`text-xs font-medium ${dayInfo.isRestDay ? 'text-orange-600' : 'text-gray-600'}`}>
                                      {dayInfo.dayName}
                                    </span>
                                    {holiday && (
                                      <span className={`inline-flex px-1.5 py-0.5 rounded text-xs whitespace-nowrap
                                        ${holiday.type==='reghol' ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'}`}>
                                        📅 {holiday.name}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${otType?.color || 'bg-gray-100 text-gray-700'}`}>
                                    {otType?.label}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt12h(entry.timeIn)}</td>
                                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmt12h(entry.timeOut)}</td>
                                <td className="px-4 py-3 font-medium text-orange-700">{entry.hours.otHours.toFixed(2)}</td>
                                <td className="px-4 py-3 text-gray-500">
                                  {entry.hours.ndHours > 0 ? entry.hours.ndHours.toFixed(2) : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-4 py-3 font-medium text-emerald-600 whitespace-nowrap">+{fmt(entry.pay.totalOTPay)}</td>
                                <td className="px-4 py-3 text-emerald-600 whitespace-nowrap">
                                  {entry.pay.ndPay > 0 ? `+${fmt(entry.pay.ndPay)}` : <span className="text-gray-300">—</span>}
                                </td>
                                <td className="px-4 py-3 font-bold text-orange-700 whitespace-nowrap">+{fmt(entry.pay.total)}</td>
                                <td className="px-4 py-3">
                                  <div className="flex gap-1">
                                    <button onClick={()=>setEditing(entry)} className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-400 hover:text-orange-700"><Edit2 size={13}/></button>
                                    <button onClick={()=>setDelConfirm(entry)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500"><Trash2 size={13}/></button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        {/* Row totals */}
                        <tfoot>
                          <tr className="bg-orange-50/60 border-t border-orange-100 text-sm font-semibold text-orange-800">
                            <td colSpan={5} className="px-4 py-2.5 text-xs uppercase tracking-wide text-orange-600">Subtotal</td>
                            <td className="px-4 py-2.5">{totals.otHours.toFixed(2)} hrs</td>
                            <td className="px-4 py-2.5">{totals.ndHours > 0 ? totals.ndHours.toFixed(2) : '—'}</td>
                            <td className="px-4 py-2.5 text-emerald-600">+{fmt(totals.otPay)}</td>
                            <td className="px-4 py-2.5 text-emerald-600">{totals.ndPay > 0 ? `+${fmt(totals.ndPay)}` : '—'}</td>
                            <td className="px-4 py-2.5 text-orange-800">+{fmt(totals.total)}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Grand Total Banner ── */}
      {coEntries.length > 0 && (
        <div className="bg-orange-700 text-white rounded-2xl px-6 py-4 flex items-center justify-between">
          <div className="flex gap-6 text-sm">
            <span className="opacity-80">{Object.keys(byEmployee).length} employees</span>
            <span className="opacity-40">·</span>
            <span className="opacity-80">{coEntries.length} total entries</span>
            <span className="opacity-40">·</span>
            <span className="opacity-80">Total OT: <strong className="opacity-100">{grand.otHours.toFixed(2)} hrs</strong></span>
            {grand.ndHours > 0 && <>
              <span className="opacity-40">·</span>
              <span className="opacity-80">🌙 ND: <strong>{grand.ndHours.toFixed(2)} hrs</strong></span>
            </>}
          </div>
          <div className="text-right">
            <p className="text-xs opacity-60 uppercase tracking-wide">Grand Total OT Pay</p>
            <p className="text-2xl font-bold">{fmt(grand.total)}</p>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {/* Batch Add / multi-date form */}
      <Modal isOpen={batchEmpId !== null} onClose={()=>setBatchEmpId(null)}
        title={batchEmpId ? `Add OT — ${empMap[batchEmpId]?.name}` : 'Add OT Entry'} extraWide>
        {batchEmpId !== null && (
          <OTBatchForm
            initialEmpId={batchEmpId}
            onSaveAll={saveBatch}
            onClose={()=>setBatchEmpId(null)}
            employees={state.employees}/>
        )}
      </Modal>

      {/* Edit single entry */}
      <Modal isOpen={!!editing} onClose={()=>setEditing(null)} title="Edit OT Entry" wide>
        {editing && <OTEntryForm initial={editing} onSave={updateEntry} onClose={()=>setEditing(null)} employees={state.employees}/>}
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!delConfirm} onClose={()=>setDelConfirm(null)} title="Confirm Delete">
        {delConfirm && (
          <div className="space-y-4">
            <p className="text-gray-600">
              Delete OT entry for <strong>{empMap[delConfirm.employeeId]?.name}</strong> on {fmtDate(delConfirm.date)}?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={()=>setDelConfirm(null)} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
              <button onClick={()=>deleteEntry(delConfirm.id)} className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 font-medium">Delete</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id:'dashboard',   label:'Dashboard',        icon:Home        },
  { id:'employees',   label:'Employees',         icon:Users       },
  { id:'payroll',     label:'Run Payroll',       icon:DollarSign  },
  { id:'attendance',  label:'Attendance & Leave',icon:Clock       },
  { id:'ot',          label:'OT Processing',     icon:Timer       },
  { id:'history',     label:'Payroll History',   icon:History     },
  { id:'reports',     label:'Reports',           icon:BarChart2   },
];

function Sidebar({ active, setActive, collapsed, setCollapsed }) {
  return (
    <div className={`${collapsed?'w-16':'w-56'} flex flex-col transition-all duration-300 flex-shrink-0`} style={{background:'#1a0e00'}}>
      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-4 py-4 border-b border-white/10 ${collapsed?'justify-center':''}`}>
        <img src="/dragonai-logo.png" alt="Dragon AI" className="w-8 h-8 object-contain flex-shrink-0"/>
        {!collapsed && (
          <div className="leading-tight">
            <p className="font-bold text-white text-sm tracking-wide">DRAGON AI</p>
            <p className="text-xs font-medium" style={{color:'#f97316'}}>Payroll System</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button key={item.id} onClick={()=>setActive(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                ${collapsed ? 'justify-center' : ''}`}
              style={isActive
                ? { background:'#c2410c', color:'#fff' }
                : { color:'#9ca3af' }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background='rgba(255,255,255,0.07)'; e.currentTarget.style.color='#e5e7eb'; }}}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background=''; e.currentTarget.style.color='#9ca3af'; }}}
              title={collapsed ? item.label : ''}>
              <Icon size={18} className="flex-shrink-0"/>
              {!collapsed && item.label}
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button onClick={()=>setCollapsed(!collapsed)}
        className="flex items-center justify-center gap-2 px-4 py-4 text-gray-500 hover:text-gray-300 border-t border-white/10 text-xs">
        <ChevronRight size={16} className={`transition-transform ${collapsed?'':'rotate-180'}`}/>
        {!collapsed && 'Collapse'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function PayrollApp() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [activePage, setActivePage] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const PAGE_MAP = {
    dashboard:  <Dashboard/>,
    employees:  <EmployeeManagement/>,
    payroll:    <PayrollProcessing/>,
    attendance: <AttendanceLeave/>,
    ot:         <OTProcessing/>,
    history:    <PayrollHistory/>,
    reports:    <Reports/>,
  };

  const currentNav = NAV_ITEMS.find(n=>n.id===activePage);

  return (
    <AppCtx.Provider value={{ state, dispatch }}>
      <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex">
          <Sidebar active={activePage} setActive={setActivePage} collapsed={collapsed} setCollapsed={setCollapsed}/>
        </div>

        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-30 flex md:hidden">
            <div className="w-56 flex flex-col z-40" style={{background:'#1a0e00'}}>
              <div className="flex items-center gap-2.5 px-4 py-4 border-b border-white/10">
                <img src="/dragonai-logo.png" alt="Dragon AI" className="w-8 h-8 object-contain flex-shrink-0"/>
                <div className="leading-tight">
                  <p className="font-bold text-white text-sm">DRAGON AI</p>
                  <p className="text-xs font-medium" style={{color:'#f97316'}}>Payroll System</p>
                </div>
                <button onClick={()=>setMobileMenuOpen(false)} className="ml-auto text-gray-400"><X size={18}/></button>
              </div>
              <nav className="flex-1 py-4 space-y-0.5 px-2">
                {NAV_ITEMS.map(item => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button key={item.id} onClick={()=>{setActivePage(item.id);setMobileMenuOpen(false);}}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={isActive ? {background:'#c2410c',color:'#fff'} : {color:'#9ca3af'}}>
                      <Icon size={18}/>{item.label}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="flex-1 bg-black/50" onClick={()=>setMobileMenuOpen(false)}/>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Bar */}
          <header className="bg-white border-b border-gray-100 px-4 md:px-6 py-3.5 flex items-center gap-3 flex-shrink-0">
            <button className="md:hidden p-1.5 rounded-lg hover:bg-gray-100" onClick={()=>setMobileMenuOpen(true)}>
              <Menu size={20} className="text-gray-600"/>
            </button>
            <div className="flex items-center gap-1.5 text-sm text-gray-500">
              <span className="font-medium text-gray-800">{currentNav?.label}</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="relative">
                <Bell size={18} className="text-gray-400"/>
                {state.attendance.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center">
                    {state.attendance.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-700 rounded-full flex items-center justify-center text-white text-xs font-bold">HR</div>
                <div className="hidden sm:block text-sm">
                  <p className="font-medium text-gray-800 leading-tight">HR Admin</p>
                  <p className="text-xs text-gray-400">Payroll Manager</p>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto">
            {PAGE_MAP[activePage]}
          </main>
        </div>

        <Toasts/>
      </div>
    </AppCtx.Provider>
  );
}
