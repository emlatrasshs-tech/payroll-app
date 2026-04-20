import React, {
  useState, useReducer, useContext, createContext,
  useCallback, useMemo, useRef, useEffect
} from 'react';
import { supabase } from './supabase';
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
  ChevronUp, Bell, Filter, ArrowUpRight, ArrowDownRight, Timer,
  UserMinus, Banknote, Lock, Unlock, CalendarX,
  ShieldCheck, Building, CreditCard as CreditCardIcon, PlusCircle, MinusCircle
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// CONSTANTS & UTILITIES
// ─────────────────────────────────────────────────────────────
const DEFAULT_DEDUCTIONS = {
  sssRate:        4.5,
  sssCap:         900,
  philHealthRate: 2.5,
  philHealthMin:  250,
  philHealthCap:  2500,
  pagIbigRate:    2.0,
  pagIbigCap:     200,
};

const DEPARTMENTS = ['Events', 'Social Media', 'Human Resources', 'Operations', 'Creative', 'Support', 'Esports'];
const DEPT_COLORS = {
  Events: '#c2410c', 'Social Media': '#f59e0b',
  'Human Resources': '#10b981', Operations: '#ec4899',
  Creative: '#8b5cf6', Support: '#0ea5e9', Esports: '#6366f1',
};
const CHART_COLORS = ['#c2410c','#f59e0b','#10b981','#ec4899','#3b82f6','#8b5cf6'];
const POSITIONS = {
  Events:           ['Events and Logistics Support Coordinator','Event Coordinator Assistant','Account Manager','Events and Account Manager','Event Assistant'],
  'Social Media':   ['Graphic & Social Media Specialist','Marketing and Creative Assistant','Social Media Manager','Content Creator'],
  'Human Resources':['HR Assistant','HR Manager','HR Specialist','Recruiter'],
  Operations:       ['Executive Driver','Photographer','Operations Manager','Office Assistant'],
  Esports:          ['Esports Manager','Team Coach','Esports Coordinator','Esports Analyst','Content Creator'],
};
const EMP_TYPES = ['Regular','Probationary','Full-Time','Part-Time','Contractor','Project Based'];
const PAY_FREQS = ['Bi-Monthly','Monthly','Bi-Weekly','Weekly'];

const LEAVE_TYPES = [
  { id:'absent',      label:'Absent (Unexcused)',     paid:false, daysField:true,  badge:'bg-red-100 text-red-700'            },
  { id:'late',        label:'Tardy / Late',           paid:false, daysField:false, badge:'bg-yellow-100 text-yellow-700'      },
  { id:'sick',        label:'Sick Leave',             paid:true,  daysField:true,  badge:'bg-blue-100 text-blue-700'          },
  { id:'vacation',    label:'Vacation Leave',         paid:true,  daysField:true,  badge:'bg-teal-100 text-teal-700'          },
  { id:'sil',         label:'Service Incentive Leave',paid:true,  daysField:true,  badge:'bg-purple-100 text-purple-700'      },
  { id:'personal',    label:'Personal Leave',         paid:false, daysField:true,  badge:'bg-orange-100 text-orange-700'      },
  { id:'maternity',   label:'Maternity Leave',        paid:true,  daysField:true,  badge:'bg-pink-100 text-pink-700'          },
  { id:'paternity',   label:'Paternity Leave',        paid:true,  daysField:true,  badge:'bg-sky-100 text-sky-700'            },
  { id:'emergency',   label:'Emergency Leave',        paid:false, daysField:true,  badge:'bg-amber-100 text-amber-700'        },
  { id:'bereavement', label:'Bereavement Leave',      paid:false, daysField:true,  badge:'bg-gray-200 text-gray-700'          },
  { id:'other',       label:'Other Leave',            paid:false, daysField:true,  badge:'bg-gray-100 text-gray-500'          },
];
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

function calcGovContribs(monthlySalary, s = DEFAULT_DEDUCTIONS) {
  const sss        = Math.min(monthlySalary * (s.sssRate / 100), s.sssCap);
  const philHealth = Math.min(Math.max(monthlySalary * (s.philHealthRate / 100), s.philHealthMin), s.philHealthCap);
  const pagIbig    = monthlySalary <= 1500 ? monthlySalary * 0.01 : Math.min(monthlySalary * (s.pagIbigRate / 100), s.pagIbigCap);
  return { sss, philHealth, pagIbig };
}

// Count Mon–Sat working days in a date range (inclusive)
// Excludes: Sundays, Regular Holidays, Special Non-Working Holidays, and any extra declared holiday dates
function countWorkingDays(startDate, endDate, extraHolidayDates = []) {
  const extraSet = new Set(extraHolidayDates);
  let count = 0;
  const cur = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (cur <= end) {
    const dow     = cur.getDay();
    const dateStr = cur.toISOString().split('T')[0];
    const phHol   = PH_HOLIDAYS[dateStr];
    // Regular Holidays & Special Non-Working = not a working day
    // Special Working = still a working day (no work no pay)
    const isNonWorkingHoliday = phHol && phHol.type !== 'specwork';
    if (dow !== 0 && !isNonWorkingHoliday && !extraSet.has(dateStr)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// Compute holiday premium/deduction for one employee in a cut-off
function computeHolidayPay(holidayEntries, startDate, endDate, employeeId, dailyRate) {
  let premium   = 0;
  let deduction = 0;
  (holidayEntries || []).forEach(e => {
    if (e.employeeId !== employeeId) return;
    if (e.date < startDate || e.date > endDate) return;
    if (e.status !== 'Approved') return;
    const hours      = +(e.hoursWorked || 8);
    const hourlyRate = dailyRate / 8;
    if (e.holidayType === 'reghol') {
      if (e.worked) premium += hourlyRate * hours; // 100% premium (total 200%)
      // not worked → 100% already in salary, no deduction
    } else if (e.holidayType === 'spechol') {
      if (e.worked) premium += hourlyRate * hours * 0.30; // 30% premium
      else deduction += dailyRate;                        // no work no pay
    } else if (e.holidayType === 'specwork') {
      if (!e.worked) deduction += dailyRate;             // no work no pay
      // worked → regular pay, no premium
    }
  });
  return { premium, deduction };
}

// cutOff: 1 = basic half-salary only, no allowance, no gov deductions
//         2 = basic half-salary + allowance, apply gov deductions (no tax per policy)
function calcPayslip(emp, periodDays = 13, absences = 0, lateMinutes = 0, overtime = 0, cutOff = 2, reimbursement = 0, otPayDirect = 0, deductionSettings = DEFAULT_DEDUCTIONS, holidayPremium = 0, holidayDeduction = 0) {
  const monthlySalary = emp.salary || 0;
  const halfSalary    = monthlySalary / 2;
  const allowance     = cutOff === 2 ? (emp.allowance || 0) : 0;
  const dailyRate     = monthlySalary / 26;
  const workingDays   = periodDays; // dynamic Mon–Sat count
  const daysAttended  = Math.max(0, workingDays - absences);
  const absenceDeduct = dailyRate * absences;
  const lateDeduct    = (dailyRate / 8 / 60) * lateMinutes;
  // otPayDirect = pre-computed from approved OT entries; falls back to simple formula
  const overtimePay   = otPayDirect > 0 ? otPayDirect : (dailyRate / 8) * 1.25 * overtime;
  const grossPay      = Math.max(0, halfSalary + allowance + reimbursement - absenceDeduct - lateDeduct + overtimePay + holidayPremium - holidayDeduction);

  // Gov deductions only on Cut-Off 2
  // Use manual overrides if set, otherwise auto-compute from salary brackets
  let sss = 0, philHealth = 0, pagIbig = 0;
  if (cutOff === 2) {
    const gov  = calcGovContribs(monthlySalary, deductionSettings);
    sss        = emp.sssContribOverride   != null && emp.sssContribOverride   !== '' ? +emp.sssContribOverride   : gov.sss;
    philHealth = emp.philHealthContribOverride != null && emp.philHealthContribOverride !== '' ? +emp.philHealthContribOverride : gov.philHealth;
    pagIbig    = emp.hdmfContribOverride  != null && emp.hdmfContribOverride  !== '' ? +emp.hdmfContribOverride  : gov.pagIbig;
  }

  // Loan deductions (each cut-off) — always deducted regardless of cut-off
  const sssLoan     = +(emp.sssLoanPerCutOff  || 0);
  const hdmfLoan    = +(emp.hdmfLoanPerCutOff || 0);
  const companyLoan = +(emp.companyLoan?.perCutOff || 0);
  const otherLoans  = (emp.otherLoans || []).reduce((s, l) => s + (+(l.perCutOff || 0)), 0);

  const totalGovDeduct  = sss + philHealth + pagIbig;
  const totalLoanDeduct = sssLoan + hdmfLoan + companyLoan + otherLoans;
  const totalDeduct     = totalGovDeduct + totalLoanDeduct;
  const netPay          = grossPay - totalDeduct;

  return {
    grossPay, baseSalary: halfSalary, allowance, reimbursement,
    absenceDeduct, lateDeduct, overtimePay,
    holidayPremium, holidayDeduction,
    sss, philHealth, pagIbig, tax: 0,
    sssLoan, hdmfLoan, companyLoan, otherLoans,
    totalGovDeduct, totalLoanDeduct,
    totalDeductions: totalDeduct, netPay,
    dailyRate, workingDays, daysAttended, absences, lateMinutes, overtime, cutOff,
  };
}

// ─────────────────────────────────────────────────────────────
// FINAL PAY COMPUTATION ENGINE
// ─────────────────────────────────────────────────────────────
function calcFinalPay(emp, lwdStr, otEntries) {
  const lwdDate  = new Date(lwdStr + 'T00:00:00');
  const lwdYear  = lwdDate.getFullYear();
  const lwdMonth = lwdDate.getMonth() + 1;
  const lwdDay   = lwdDate.getDate();

  // Determine which cut-off period the LWD falls in
  const sched      = getCutOffSchedule(lwdYear, lwdMonth);
  const cutOffNum  = lwdDay <= 15 ? 1 : 2;
  const cutOffSched = cutOffNum === 1 ? sched.cutOff1 : sched.cutOff2;

  // Days actually worked in the final cut-off period
  const cutOffStart        = new Date(cutOffSched.startDate + 'T00:00:00');
  const daysWorkedInPeriod = Math.max(1, Math.floor((lwdDate - cutOffStart) / 86400000) + 1);

  const dailyRate      = (emp.salary || 0) / 26;
  const proratedSalary = dailyRate * daysWorkedInPeriod;

  // Allowance only on cut-off 2
  const allowance = cutOffNum === 2 ? (emp.allowance || 0) : 0;

  // Gov deductions only on cut-off 2
  let sss = 0, philHealth = 0, pagIbig = 0;
  if (cutOffNum === 2) {
    const gov = calcGovContribs(emp.salary || 0);
    sss       = gov.sss;
    philHealth = gov.philHealth;
    pagIbig   = gov.pagIbig;
  }

  // Pending OT pay (all OT entries for this employee not yet in a paid run)
  const empOT = (otEntries || []).filter(e => e.employeeId === emp.id);
  const otPay = empOT.reduce((sum, e) => sum + ((e.pay && e.pay.totalPay) || 0), 0);

  // Prorated 13th month pay (Philippine standard: basic salary earned in calendar year / 12)
  const yearStart = new Date(Math.max(
    new Date(`${lwdYear}-01-01T00:00:00`).getTime(),
    new Date((emp.hireDate || `${lwdYear}-01-01`) + 'T00:00:00').getTime()
  ));
  const daysWorkedThisYear = Math.max(1, Math.floor((lwdDate - yearStart) / 86400000) + 1);
  const thirteenthMonth    = ((emp.salary || 0) * daysWorkedThisYear) / (26 * 12);

  const grossFinalPay    = proratedSalary + allowance + otPay + thirteenthMonth;
  const totalDeductions  = sss + philHealth + pagIbig;
  const netFinalPay      = grossFinalPay - totalDeductions;

  // 30-day hold release date
  const relDate = new Date(lwdDate);
  relDate.setDate(relDate.getDate() + 30);

  return {
    dailyRate, daysWorkedInPeriod, proratedSalary,
    allowance, otPay, thirteenthMonth,
    grossFinalPay, sss, philHealth, pagIbig,
    totalDeductions, netFinalPay,
    cutOffNum, cutOffPeriod: cutOffSched.label,
    daysWorkedThisYear,
    releaseDate: relDate.toISOString().split('T')[0],
    releaseDateLabel: relDate.toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' }),
  };
}

// ─────────────────────────────────────────────────────────────
// SIL COMPUTATION  (5 days/year, accrues monthly after 1yr service)
// ─────────────────────────────────────────────────────────────
function calcSIL(emp, attendanceRecords, asOfDate) {
  if (!emp || !emp.hireDate) return { eligible:false, accrued:0, used:0, balance:0 };
  const hireDate    = new Date(emp.hireDate + 'T00:00:00');
  const asOf        = new Date(asOfDate    + 'T00:00:00');
  const eligibleDate = new Date(hireDate);
  eligibleDate.setFullYear(eligibleDate.getFullYear() + 1);

  if (asOf < eligibleDate) {
    return {
      eligible:     false,
      eligibleDate: eligibleDate.toISOString().split('T')[0],
      daysLeft:     Math.ceil((eligibleDate - asOf) / 86400000),
      accrued: 0, used: 0, balance: 0, maxPerYear: 5,
    };
  }

  // Accrual restarts each calendar year; starting from the later of Jan 1 or eligibility date
  const cy         = asOf.getFullYear();
  const yearStart  = new Date(`${cy}-01-01T00:00:00`);
  const accrualStart = new Date(Math.max(eligibleDate.getTime(), yearStart.getTime()));

  // Months elapsed (inclusive of current month)
  let months = (asOf.getFullYear() - accrualStart.getFullYear()) * 12
             + (asOf.getMonth()    - accrualStart.getMonth());
  if (asOf.getDate() >= accrualStart.getDate()) months++;

  const accrued = parseFloat(Math.min(months * (5 / 12), 5).toFixed(2));

  // SIL used this calendar year (support both lowercase 'sil' and old-style records)
  const yearStartStr = `${cy}-01-01`;
  const yearEndStr   = `${cy}-12-31`;
  const used = (attendanceRecords || [])
    .filter(r => r.employeeId === emp.id
              && (r.type === 'sil' || r.type === 'Service Incentive Leave')
              && r.date >= yearStartStr && r.date <= yearEndStr)
    .reduce((s, r) => s + (r.days || 1), 0);

  const balance = parseFloat(Math.max(0, accrued - used).toFixed(2));
  return { eligible:true, eligibleDate: eligibleDate.toISOString().split('T')[0], accrued, used, balance, maxPerYear:5 };
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
  '2026-03-20':{ name:"Eid'l Fitr (Feast of Ramadhan)", type:'reghol' },
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
  { id:'E001', name:'ACUARIO, MAVERICK AVIEN',        firstName:'MAVERICK', middleName:'AVIEN',   lastName:'ACUARIO',    dept:'Events',          position:'Events and Logistics Support Coordinator', type:'Probationary', salary:25000, allowance:200, hireDate:'2025-10-08', taxEx:0, bank:'8029', isHourly:false },
  { id:'E002', name:'BARCELON, NIKKA ROSE',            firstName:'NIKKA',    middleName:'ROSE',    lastName:'BARCELON',   dept:'Social Media',    position:'Graphic & Social Media Specialist',        type:'Regular',      salary:28000, allowance:0,   hireDate:'2024-10-28', taxEx:0, bank:'2007', isHourly:false },
  { id:'E003', name:'CAI, YASMIN MAY',                 firstName:'YASMIN',   middleName:'MAY',     lastName:'CAI',        dept:'Events',          position:'Event Coordinator Assistant',              type:'Probationary', salary:40000, allowance:0,   hireDate:'2026-02-18', taxEx:0, bank:'8726', isHourly:false },
  { id:'E004', name:'CASTILLON, ELINEY CRISSE NICOLE', firstName:'ELINEY',   middleName:'CRISSE NICOLE', lastName:'CASTILLON', dept:'Events',     position:'Account Manager',                          type:'Probationary', salary:45000, allowance:0,   hireDate:'2025-06-09', taxEx:0, bank:'3775', isHourly:false },
  { id:'E005', name:'COBARRUBIAS, RAPHAEL OLIVER',     firstName:'RAPHAEL',  middleName:'OLIVER',  lastName:'COBARRUBIAS',dept:'Operations',      position:'Photographer',                             type:'Regular',      salary:33000, allowance:0,   hireDate:'2022-11-09', taxEx:0, bank:'0943', isHourly:false },
  { id:'E006', name:'DE JESUS, HAZEL MARIE',           firstName:'HAZEL',    middleName:'MARIE',   lastName:'DE JESUS',   dept:'Events',          position:'Events and Account Manager',               type:'Regular',      salary:48000, allowance:0,   hireDate:'2024-11-18', taxEx:0, bank:'2752', isHourly:false },
  { id:'E007', name:'DIOCENA, DENISE',                 firstName:'DENISE',   middleName:'',        lastName:'DIOCENA',    dept:'Social Media',    position:'Marketing and Creative Assistant',         type:'Regular',      salary:22000, allowance:0,   hireDate:'2024-11-12', taxEx:0, bank:'4539', isHourly:false },
  { id:'E008', name:'LATRAS, EL MARIE',                firstName:'EL',       middleName:'MARIE',   lastName:'LATRAS',     dept:'Human Resources', position:'HR Assistant',                             type:'Regular',      salary:23500, allowance:0,   hireDate:'2024-10-01', taxEx:0, bank:'3244', isHourly:false },
  { id:'E009', name:'LIM, DENISE ROSALIND',            firstName:'DENISE',   middleName:'ROSALIND',lastName:'LIM',        dept:'Events',          position:'TBD',                                      type:'Regular',      salary:0,     allowance:0,   hireDate:'2017-01-30', taxEx:0, bank:'1399', isHourly:false },
  { id:'E010', name:'NAVARRO, PAOLO LUIS',             firstName:'PAOLO',    middleName:'LUIS',    lastName:'NAVARRO',    dept:'Events',          position:'Account Manager',                          type:'Probationary', salary:35000, allowance:0,   hireDate:'2026-03-16', taxEx:0, bank:'3920', isHourly:false },
  { id:'E011', name:'PABELONA, JOHN MAYNARD',          firstName:'JOHN',     middleName:'MAYNARD', lastName:'PABELONA',   dept:'Events',          position:'Events and Logistics Support Coordinator', type:'Regular',      salary:31000, allowance:180, hireDate:'2025-07-29', taxEx:0, bank:'7783', isHourly:false },
  { id:'E012', name:'PATAWARAN, MARK YURI',            firstName:'MARK',     middleName:'YURI',    lastName:'PATAWARAN',  dept:'Events',          position:'Events and Logistics Support Coordinator', type:'Regular',      salary:31000, allowance:180, hireDate:'2025-07-07', taxEx:0, bank:'0416', isHourly:false },
  { id:'E013', name:'REMETIO, LEXIE JOAN',             firstName:'LEXIE',    middleName:'JOAN',    lastName:'REMETIO',    dept:'Events',          position:'Event Assistant',                          type:'Probationary', salary:26500, allowance:0,   hireDate:'2026-03-02', taxEx:0, bank:'1824', isHourly:false },
  { id:'E014', name:'SABANAL, ROLANDO',                firstName:'ROLANDO',  middleName:'',        lastName:'SABANAL',    dept:'Operations',      position:'Executive Driver',                         type:'Regular',      salary:32000, allowance:180, hireDate:'2025-03-31', taxEx:0, bank:'7019', isHourly:false },
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
  status: 'Approved',
}));

// ─────────────────────────────────────────────────────────────
// STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────
const initialState = {
  employees:         SEED_EMPLOYEES,
  payrollRuns:       SEED_RUNS,
  attendance:        SEED_ATTENDANCE,
  otEntries:         [],
  holidayEntries:    [],
  finalPayRecords:   [],
  toasts:            [],
  deductionSettings: DEFAULT_DEDUCTIONS,
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
    case 'UPDATE_OT_STATUS':
      return {
        ...state,
        otEntries: state.otEntries.map(e =>
          e.id === action.id
            ? { ...e, status: action.status, assignedCutOffStart: action.assignedCutOffStart ?? e.assignedCutOffStart }
            : e
        ),
      };
    case 'UPDATE_ATTENDANCE_STATUS':
      return {
        ...state,
        attendance: state.attendance.map(a =>
          a.id === action.id ? { ...a, status: action.status } : a
        ),
      };
    case 'MARK_OT_INCLUDED':
      return {
        ...state,
        otEntries: state.otEntries.map(e =>
          action.ids.includes(e.id) ? { ...e, includedInPayrollId: action.payrollId } : e
        ),
      };
    case 'SET_LAST_WORKING_DAY':
      return {
        ...state,
        employees: state.employees.map(e =>
          e.id === action.payload.employeeId
            ? { ...e, lastWorkingDay: action.payload.lastWorkingDay, separated: true }
            : e
        ),
        finalPayRecords: [action.payload, ...state.finalPayRecords],
      };
    case 'RELEASE_FINAL_PAY':
      return {
        ...state,
        finalPayRecords: state.finalPayRecords.map(r =>
          r.id === action.id ? { ...r, status: 'Released', releasedOn: today() } : r
        ),
      };
    case 'TOAST':
      return { ...state, toasts: [...state.toasts, { id: uid(), ...action.payload }] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.id) };
    case 'UPDATE_DEDUCTION_SETTINGS':
      return { ...state, deductionSettings: { ...state.deductionSettings, ...action.payload } };
    case 'ADD_HOLIDAY_ENTRY':
      return { ...state, holidayEntries: [...state.holidayEntries, action.payload] };
    case 'UPDATE_HOLIDAY_ENTRY':
      return { ...state, holidayEntries: state.holidayEntries.map(e => e.id === action.payload.id ? action.payload : e) };
    case 'DELETE_HOLIDAY_ENTRY':
      return { ...state, holidayEntries: state.holidayEntries.filter(e => e.id !== action.id) };
    case 'LOAD_STATE':
      return { ...initialState, ...action.payload, toasts: [] };
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
// NOTIFICATION ENGINE
// ─────────────────────────────────────────────────────────────
function useNotifications(state) {
  return useMemo(() => {
    const todayStr  = today();
    const todayDate = new Date(todayStr + 'T00:00:00');
    const notifications = [];
    const diffDays = (a, b) => Math.floor((a - b) / 86400000);

    // 1. Overdue payroll runs (Processing but release date already passed)
    state.payrollRuns.forEach(run => {
      if (run.status === 'Processing' && run.releaseDate) {
        const releaseDate = new Date(run.releaseDate + 'T00:00:00');
        const diff = diffDays(todayDate, releaseDate);
        if (diff > 0) {
          notifications.push({
            id: `overdue-${run.id}`, type: 'urgent',
            title: 'Overdue Payroll Release',
            message: `${run.period} was due on ${run.releaseDateLabel} — ${diff} day${diff !== 1 ? 's' : ''} overdue.`,
            action: 'Process Now', page: 'payroll',
          });
        } else if (diff >= -3) {
          const daysLeft = -diff;
          notifications.push({
            id: `release-soon-${run.id}`, type: 'warning',
            title: 'Payroll Release Approaching',
            message: `${run.period} is due for release on ${run.releaseDateLabel}${daysLeft === 0 ? ' — today!' : ` in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}.`,
            action: 'View Payroll', page: 'payroll',
          });
        }
      }
    });

    // 2. Upcoming cut-off end dates (within 3 days, not yet processed)
    const processedStarts = new Set(state.payrollRuns.map(r => r.startDate));
    [0, 1].forEach(offset => {
      let m = todayDate.getMonth() + 1 + offset;
      let y = todayDate.getFullYear();
      if (m > 12) { m -= 12; y++; }
      const sched = getCutOffSchedule(y, m);
      [sched.cutOff1, sched.cutOff2].forEach(co => {
        if (processedStarts.has(co.startDate)) return;
        const endDate  = new Date(co.endDate + 'T00:00:00');
        const daysLeft = diffDays(endDate, todayDate);
        if (daysLeft >= 0 && daysLeft <= 3) {
          notifications.push({
            id: `cutoff-end-${co.startDate}`, type: daysLeft <= 1 ? 'urgent' : 'warning',
            title: 'Cut-Off Deadline',
            message: `${co.label} cut-off ends ${daysLeft === 0 ? 'today!' : `in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`} — run payroll before it closes.`,
            action: 'Process Payroll', page: 'payroll',
          });
        }
      });
    });

    // 3. Government contribution remittance deadlines (within 7 days)
    const cm = todayDate.getMonth() + 1;
    const cy = todayDate.getFullYear();
    const nm = cm === 12 ? 1 : cm + 1;
    const ny = cm === 12 ? cy + 1 : cy;
    const nm2 = nm === 12 ? 1 : nm + 1;
    const ny2 = nm === 12 ? ny + 1 : ny;
    const govItems = [
      { name: 'SSS',        day: 30,                           month: nm,  year: ny  },
      { name: 'PhilHealth', day: getLastDayOfMonth(ny, nm),    month: nm,  year: ny  },
      { name: 'Pag-IBIG',   day: 15,                           month: nm2, year: ny2 },
    ];
    govItems.forEach(({ name, day, month, year }) => {
      const dueDate  = new Date(`${year}-${pad(month)}-${pad(day)}T00:00:00`);
      const daysLeft = diffDays(dueDate, todayDate);
      if (daysLeft >= 0 && daysLeft <= 7) {
        notifications.push({
          id: `gov-${name}-${month}-${year}`, type: daysLeft <= 2 ? 'warning' : 'info',
          title: `${name} Remittance Due`,
          message: `${name} contributions for ${MONTH_NAMES[cm - 1]} due on ${MONTH_NAMES[month - 1]} ${day}${daysLeft === 0 ? ' — today!' : ` (${daysLeft} day${daysLeft !== 1 ? 's' : ''} left)`}.`,
          action: 'View Reports', page: 'reports',
        });
      }
    });

    // 4. Today's attendance issues
    const todayAtt = state.attendance.filter(a => a.date === todayStr);
    const absents  = todayAtt.filter(a => a.type === 'Absent').length;
    const lates    = todayAtt.filter(a => a.type === 'Late').length;
    if (absents > 0) notifications.push({
      id: 'att-absent-today', type: 'warning',
      title: 'Absent Employees Today',
      message: `${absents} employee${absents !== 1 ? 's are' : ' is'} marked absent today. Review attendance records.`,
      action: 'View Attendance', page: 'attendance',
    });
    if (lates > 0) notifications.push({
      id: 'att-late-today', type: 'info',
      title: 'Late Arrivals Today',
      message: `${lates} employee${lates !== 1 ? 's' : ''} logged late today.`,
      action: 'View Attendance', page: 'attendance',
    });

    // 5. Probationary employees nearing regularization (within 30 days)
    state.employees.forEach(emp => {
      if (emp.type === 'Probationary' && emp.hireDate) {
        const reg = new Date(emp.hireDate + 'T00:00:00');
        reg.setMonth(reg.getMonth() + 6);
        const daysLeft = diffDays(reg, todayDate);
        if (daysLeft >= 0 && daysLeft <= 30) {
          notifications.push({
            id: `prob-${emp.id}`, type: daysLeft <= 7 ? 'warning' : 'info',
            title: 'Regularization Due Soon',
            message: `${emp.name.split(' ').slice(0, 2).join(' ')} completes probation on ${fmtDate(reg.toISOString().split('T')[0])}${daysLeft === 0 ? ' — today!' : ` (${daysLeft} day${daysLeft !== 1 ? 's' : ''})`}.`,
            action: 'View Employee', page: 'employees',
          });
        }
      }
    });

    // 6. Employees with no salary set
    const noSal = state.employees.filter(e => !e.salary || e.salary === 0);
    if (noSal.length > 0) notifications.push({
      id: 'no-salary', type: 'warning',
      title: 'Incomplete Salary Records',
      message: `${noSal.length} employee${noSal.length !== 1 ? 's have' : ' has'} no salary set: ${noSal.slice(0, 3).map(e => e.name.split(' ')[0]).join(', ')}${noSal.length > 3 ? '…' : ''}.`,
      action: 'Fix Now', page: 'employees',
    });

    // 7. Pending OT / Attendance entries — split by overdue vs current cut-off
    {
      const nowDay = todayDate.getDate();
      const nowM   = todayDate.getMonth() + 1;
      const nowY   = todayDate.getFullYear();
      const nowSched  = getCutOffSchedule(nowY, nowM);
      const currCOEnd = nowDay <= 15 ? nowSched.cutOff1.endDate : nowSched.cutOff2.endDate;

      // OT: pending and not yet included
      const pendingOT = state.otEntries.filter(e => e.status === 'Pending' && !e.includedInPayrollId);
      const overdueOT = pendingOT.filter(e => e.date < currCOEnd);
      const freshOT   = pendingOT.filter(e => e.date >= currCOEnd);

      if (overdueOT.length > 0) notifications.push({
        id: 'pending-ot-overdue', type: 'warning',
        title: 'Pending OT Past Cut-Off',
        message: `${overdueOT.length} OT entr${overdueOT.length !== 1 ? 'ies' : 'y'} still Pending from a past cut-off. Approve or carry forward to current period.`,
        action: 'Review OT', page: 'ot',
      });
      if (freshOT.length > 0) notifications.push({
        id: 'pending-ot-current', type: 'info',
        title: 'OT Entries Awaiting Approval',
        message: `${freshOT.length} OT entr${freshOT.length !== 1 ? 'ies' : 'y'} awaiting HR approval for the current cut-off.`,
        action: 'Approve OT', page: 'ot',
      });

      // Attendance: pending records
      const pendingAtt = state.attendance.filter(a => a.status === 'Pending');
      const overdueAtt = pendingAtt.filter(a => a.date < currCOEnd);
      const freshAtt   = pendingAtt.filter(a => a.date >= currCOEnd);

      if (overdueAtt.length > 0) notifications.push({
        id: 'pending-att-overdue', type: 'warning',
        title: 'Pending Leave Records Past Cut-Off',
        message: `${overdueAtt.length} leave/absence record${overdueAtt.length !== 1 ? 's' : ''} still Pending from a past cut-off. Approve before next payroll run.`,
        action: 'Review Attendance', page: 'attendance',
      });
      if (freshAtt.length > 0) notifications.push({
        id: 'pending-att-current', type: 'info',
        title: 'Leave Records Awaiting Approval',
        message: `${freshAtt.length} leave/absence record${freshAtt.length !== 1 ? 's' : ''} awaiting HR approval for the current cut-off.`,
        action: 'Approve Leave', page: 'attendance',
      });
    }

    // 8. Final pay hold status
    state.finalPayRecords.forEach(rec => {
      if (rec.status === 'Released') return;
      const relDate  = new Date(rec.releaseDate + 'T00:00:00');
      const daysLeft = diffDays(relDate, todayDate);
      if (daysLeft <= 0) {
        notifications.push({
          id: `fp-ready-${rec.id}`, type: 'urgent',
          title: 'Final Pay Ready for Release',
          message: `${rec.employeeName}'s final pay of ${fmt(rec.netFinalPay)} has cleared the 30-day hold. Ready to release.`,
          action: 'Release Now', page: 'finalpay',
        });
      } else if (daysLeft <= 7) {
        notifications.push({
          id: `fp-soon-${rec.id}`, type: 'info',
          title: 'Final Pay Hold Expiring',
          message: `${rec.employeeName}'s 30-day hold expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${rec.releaseDateLabel}).`,
          action: 'View Final Pay', page: 'finalpay',
        });
      }
    });

    // Sort: urgent → warning → info
    const order = { urgent: 0, warning: 1, info: 2 };
    return notifications.sort((a, b) => order[a.type] - order[b.type]);
  }, [state]);
}

// ─────────────────────────────────────────────────────────────
// NOTIFICATION PANEL
// ─────────────────────────────────────────────────────────────
function NotificationPanel({ notifications, onNavigate, onClose }) {
  const urgentCount  = notifications.filter(n => n.type === 'urgent').length;
  const warningCount = notifications.filter(n => n.type === 'warning').length;
  const typeConfig = {
    urgent:  { bg:'bg-red-50',    border:'border-red-200',    dot:'bg-red-500',    badge:'bg-red-100 text-red-700',       label:'Urgent'           },
    warning: { bg:'bg-orange-50', border:'border-orange-200', dot:'bg-orange-400', badge:'bg-orange-100 text-orange-700', label:'Attention Needed' },
    info:    { bg:'bg-blue-50',   border:'border-blue-200',   dot:'bg-blue-400',   badge:'bg-blue-100 text-blue-700',     label:'Info'             },
  };
  return (
    <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-gray-700"/>
          <span className="font-semibold text-gray-800">Notifications</span>
          {notifications.length > 0 && (
            <span className="bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {notifications.length}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
          <X size={16}/>
        </button>
      </div>

      {/* List */}
      <div className="overflow-y-auto flex-1 py-2">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
              <Check size={22} className="text-emerald-500"/>
            </div>
            <p className="font-medium text-gray-600">All caught up!</p>
            <p className="text-sm text-gray-400">No pending alerts or deadlines.</p>
          </div>
        ) : (
          notifications.map(notif => {
            const cfg = typeConfig[notif.type];
            return (
              <div key={notif.id} className={`mx-3 mb-2 p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                <div className="flex items-start gap-2.5">
                  <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`}/>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-xs font-semibold text-gray-800">{notif.title}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{notif.message}</p>
                    <button
                      onClick={() => { onNavigate(notif.page); onClose(); }}
                      className="mt-1.5 text-xs font-semibold text-orange-600 hover:text-orange-800 flex items-center gap-0.5 transition-colors"
                    >
                      {notif.action}<ChevronRight size={11}/>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer summary */}
      <div className="border-t border-gray-100 px-4 py-2.5 text-center text-xs text-gray-400">
        {urgentCount > 0 && <span className="text-red-500 font-semibold">{urgentCount} urgent</span>}
        {urgentCount > 0 && warningCount > 0 && <span className="mx-1">·</span>}
        {warningCount > 0 && <span className="text-orange-500 font-semibold">{warningCount} need attention</span>}
        {urgentCount === 0 && warningCount === 0 && notifications.length > 0 && <span>No critical alerts</span>}
        {notifications.length === 0 && <span>System is up to date</span>}
      </div>
    </div>
  );
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
    absent:               'bg-red-100 text-red-700',
    Late:                 'bg-yellow-100 text-yellow-700',
    late:                 'bg-yellow-100 text-yellow-700',
    sick:                 'bg-blue-100 text-blue-700',
    vacation:             'bg-teal-100 text-teal-700',
    sil:                  'bg-purple-100 text-purple-700',
    personal:             'bg-orange-100 text-orange-700',
    maternity:            'bg-pink-100 text-pink-700',
    paternity:            'bg-sky-100 text-sky-700',
    emergency:            'bg-amber-100 text-amber-700',
    bereavement:          'bg-gray-200 text-gray-700',
    other:                'bg-gray-100 text-gray-500',
    Approved:             'bg-emerald-100 text-emerald-700',
    Rejected:             'bg-red-100 text-red-600',
    'Regular OT':         'bg-blue-100 text-blue-700',
    'Rest Day OT':        'bg-orange-100 text-orange-700',
    'Regular Holiday OT': 'bg-red-100 text-red-700',
    'Special Holiday OT': 'bg-teal-100 text-teal-700',
    Separated:            'bg-gray-200 text-gray-600',
    Held:                 'bg-yellow-100 text-yellow-700',
    Released:             'bg-emerald-100 text-emerald-700',
    'Ready for Release':  'bg-blue-100 text-blue-700',
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

  // Derive initial split name fields from existing full name if not already set
  const initFirstName  = initial?.firstName  ?? '';
  const initMiddleName = initial?.middleName ?? '';
  const initLastName   = initial?.lastName   ?? '';

  const [form, setForm] = useState(initial || {
    id: nextId, name:'', firstName:'', middleName:'', lastName:'',
    dept:'Events', position:'', type:'Regular',
    salary:'', allowance:'', hireDate: today(), taxEx: 0, bank:'', isHourly:false,
  });
  const [errs,        setErrs]        = useState({});
  const [nameMode,    setNameMode]    = useState('split'); // 'split' | 'full'

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Auto-generate Full Name: LASTNAME, FIRSTNAME MIDDLENAME (ALL CAPS)
  const buildFullName = (first, middle, last) => {
    const f = first.trim().toUpperCase();
    const m = middle.trim().toUpperCase();
    const l = last.trim().toUpperCase();
    if (!f && !l) return m;
    const firstMid = [f, m].filter(Boolean).join(' ');
    return l ? `${l}, ${firstMid}` : firstMid;
  };

  const handleSplitChange = (key, val) => {
    const updated = { ...form, [key]: val };
    // Auto-fill Full Name from split fields
    const generated = buildFullName(
      key === 'firstName'  ? val : form.firstName,
      key === 'middleName' ? val : form.middleName,
      key === 'lastName'   ? val : form.lastName,
    );
    updated.name = generated;
    setForm(updated);
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (form.salary === '' || isNaN(form.salary) || +form.salary < 0) e.salary = 'Valid salary required';
    if (!form.bank.match(/^\d{4}$/)) e.bank = 'Enter last 4 digits of bank account';
    setErrs(e);
    return !Object.keys(e).length;
  };

  const submit = () => {
    if (!validate()) return;
    onSave({ ...form, salary: +form.salary, allowance: +form.allowance || 0, taxEx: +form.taxEx });
  };

  const fieldCls = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50';

  return (
    <div className="space-y-5">

      {/* ── Name Section ── */}
      <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Employee Name</p>
          <button type="button" onClick={() => setNameMode(m => m === 'split' ? 'full' : 'split')}
            className="text-xs text-orange-600 hover:text-orange-800 underline underline-offset-2">
            {nameMode === 'split' ? 'Switch to Full Name only' : 'Switch to First / Middle / Last'}
          </button>
        </div>

        {nameMode === 'split' ? (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">First Name <span className="text-red-400">*</span></label>
                <input value={form.firstName} onChange={e => handleSplitChange('firstName', e.target.value.toUpperCase())}
                  placeholder="e.g. JUAN" className={`${fieldCls} uppercase`}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Middle Name <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={form.middleName} onChange={e => handleSplitChange('middleName', e.target.value.toUpperCase())}
                  placeholder="e.g. SANTOS" className={`${fieldCls} uppercase`}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Last Name <span className="text-red-400">*</span></label>
                <input value={form.lastName} onChange={e => handleSplitChange('lastName', e.target.value.toUpperCase())}
                  placeholder="e.g. DELA CRUZ" className={`${fieldCls} uppercase`}/>
              </div>
            </div>
            {/* Full name preview / override */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Full Name <span className="text-gray-400 font-normal ml-1">— auto-generated · editable</span>
              </label>
              <input value={form.name} onChange={e => f('name', e.target.value)}
                placeholder="Auto-filled from above"
                className={`${fieldCls} ${form.name ? 'border-orange-300 bg-white font-medium' : ''}`}/>
              {errs.name && <p className="text-xs text-red-500 mt-1">{errs.name}</p>}
            </div>
          </>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name <span className="text-red-400">*</span></label>
            <input value={form.name} onChange={e => f('name', e.target.value)}
              placeholder="e.g. Juan Santos dela Cruz" className={fieldCls}/>
            {errs.name && <p className="text-xs text-red-500 mt-1">{errs.name}</p>}
          </div>
        )}
      </div>

      {/* ── Rest of the form ── */}
      <div className="grid grid-cols-2 gap-4">
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
      </div>

      <div className="flex gap-3 justify-end pt-1">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
        <button onClick={submit} className="px-5 py-2 text-sm rounded-lg bg-orange-700 text-white hover:bg-orange-800 font-medium">
          {initial ? 'Save Changes' : 'Add Employee'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LAST WORKING DAY MODAL
// ─────────────────────────────────────────────────────────────
function LWDModal({ employee, onSave, onClose }) {
  const { state } = useApp();
  const [lwd, setLwd]     = useState(today());
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (lwd && employee) {
      try { setPreview(calcFinalPay(employee, lwd, state.otEntries)); }
      catch { setPreview(null); }
    }
  }, [lwd, employee, state.otEntries]);

  const row = (label, value, highlight) => (
    <div className={`flex justify-between items-center py-1.5 px-3 rounded-lg ${highlight ? 'bg-orange-50' : 'bg-gray-50'}`}>
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-orange-700' : 'text-gray-800'}`}>{value}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
        <Lock size={15} className="mt-0.5 flex-shrink-0"/>
        <span>Final pay will be <strong>held for 30 days</strong> from the last working day per DOLE regulations before it can be released.</span>
      </div>

      {/* LWD input */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Last Working Day</label>
        <input type="date" value={lwd} onChange={e => setLwd(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400"/>
      </div>

      {/* Final pay preview */}
      {preview && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Final Pay Breakdown</p>

          <div className="space-y-1.5">
            <p className="text-[11px] text-gray-400 font-medium px-1">EARNINGS</p>
            {row(`Prorated Salary (${preview.daysWorkedInPeriod}d in ${preview.cutOffPeriod})`, fmt(preview.proratedSalary))}
            {preview.allowance > 0 && row('Load Allowance', fmt(preview.allowance))}
            {preview.otPay > 0    && row('Overtime Pay',    fmt(preview.otPay))}
            {row(`Prorated 13th Month (${preview.daysWorkedThisYear} days this year)`, fmt(preview.thirteenthMonth))}

            <p className="text-[11px] text-gray-400 font-medium px-1 pt-1">DEDUCTIONS</p>
            {preview.cutOffNum === 2 ? (
              <>
                {row('SSS',        fmt(preview.sss))}
                {row('PhilHealth', fmt(preview.philHealth))}
                {row('Pag-IBIG',   fmt(preview.pagIbig))}
              </>
            ) : (
              <div className="px-3 py-1.5 text-xs text-gray-400 italic bg-gray-50 rounded-lg">No gov't deductions (Cut-Off 1)</div>
            )}

            <div className="border-t border-gray-200 pt-1.5 space-y-1.5">
              {row('Gross Final Pay', fmt(preview.grossFinalPay))}
              {preview.totalDeductions > 0 && row('Total Deductions', `− ${fmt(preview.totalDeductions)}`)}
              {row('Net Final Pay', fmt(preview.netFinalPay), true)}
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100 text-sm text-blue-800">
            <Lock size={13} className="flex-shrink-0"/>
            <span>Hold until: <strong>{preview.releaseDateLabel}</strong></span>
          </div>
        </div>
      )}

      <div className="flex gap-3 justify-end pt-1">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
        <button
          onClick={() => preview && onSave(lwd, preview)}
          disabled={!preview}
          className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-orange-700 text-white hover:bg-orange-800 font-medium disabled:opacity-50"
        >
          <CalendarX size={15}/> Confirm Last Working Day
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// FINAL PAY PAGE
// ─────────────────────────────────────────────────────────────
function FinalPayPage() {
  const { state, dispatch } = useApp();
  const [viewDetail, setViewDetail] = useState(null);
  const empMap = useMemo(() => Object.fromEntries(state.employees.map(e => [e.id, e])), [state.employees]);
  const todayStr  = today();

  const records = state.finalPayRecords.map(rec => {
    const releaseDate = new Date(rec.releaseDate + 'T00:00:00');
    const todayDate   = new Date(todayStr + 'T00:00:00');
    const daysLeft    = Math.floor((releaseDate - todayDate) / 86400000);
    const autoStatus  = rec.status === 'Released' ? 'Released'
                      : daysLeft <= 0              ? 'Ready for Release'
                      : 'Held';
    return { ...rec, autoStatus, daysLeft };
  });

  const held    = records.filter(r => r.autoStatus === 'Held').length;
  const ready   = records.filter(r => r.autoStatus === 'Ready for Release').length;
  const released = records.filter(r => r.autoStatus === 'Released').length;

  const releasePay = (rec) => {
    dispatch({ type: 'RELEASE_FINAL_PAY', id: rec.id });
    toast(dispatch, `Final pay released for ${rec.employeeName}`);
    setViewDetail(null);
  };

  const DetailRow = ({ label, value, highlight, deduct }) => (
    <div className={`flex justify-between items-center py-1.5 px-3 rounded-lg ${highlight ? 'bg-orange-50' : 'bg-gray-50'}`}>
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-orange-700' : deduct ? 'text-red-600' : 'text-gray-800'}`}>{value}</span>
    </div>
  );

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Final Pay</h1>
        <p className="text-sm text-gray-500">Separation clearance &amp; final pay management</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <Lock size={20} className="text-yellow-600 flex-shrink-0"/>
          <div>
            <p className="text-2xl font-bold text-yellow-700">{held}</p>
            <p className="text-xs text-yellow-600 font-medium">On Hold</p>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <Unlock size={20} className="text-blue-600 flex-shrink-0"/>
          <div>
            <p className="text-2xl font-bold text-blue-700">{ready}</p>
            <p className="text-xs text-blue-600 font-medium">Ready for Release</p>
          </div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center gap-3">
          <Check size={20} className="text-emerald-600 flex-shrink-0"/>
          <div>
            <p className="text-2xl font-bold text-emerald-700">{released}</p>
            <p className="text-xs text-emerald-600 font-medium">Released</p>
          </div>
        </div>
      </div>

      {/* Records table */}
      {records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center py-16 text-gray-400">
          <UserMinus size={36} className="mb-3 text-gray-300"/>
          <p className="font-medium text-gray-500">No separation records yet</p>
          <p className="text-sm mt-1">Record an employee's last working day from the Employees page.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  {['Employee','Dept','Last Working Day','Release Date','Hold Remaining','Gross Final Pay','Net Final Pay','Status',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {records.map(rec => {
                  const emp = empMap[rec.employeeId];
                  return (
                    <tr key={rec.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800">{rec.employeeName}</td>
                      <td className="px-4 py-3 text-gray-500">{emp?.dept || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{fmtDate(rec.lastWorkingDay)}</td>
                      <td className="px-4 py-3 text-gray-600">{rec.releaseDateLabel}</td>
                      <td className="px-4 py-3">
                        {rec.autoStatus === 'Released'
                          ? <span className="text-emerald-600 text-xs font-medium">Released {fmtDate(rec.releasedOn)}</span>
                          : rec.daysLeft <= 0
                            ? <span className="text-blue-600 font-semibold text-xs">Ready ✓</span>
                            : <span className="text-yellow-700 font-medium text-xs">{rec.daysLeft}d remaining</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-700">{fmt(rec.grossFinalPay)}</td>
                      <td className="px-4 py-3 font-bold text-orange-700">{fmt(rec.netFinalPay)}</td>
                      <td className="px-4 py-3"><Badge status={rec.autoStatus}/></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <button onClick={() => setViewDetail(rec)}
                            className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-700" title="View breakdown">
                            <Eye size={14}/>
                          </button>
                          {rec.autoStatus === 'Ready for Release' && (
                            <button onClick={() => releasePay(rec)}
                              className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600" title="Mark as Released">
                              <Unlock size={14}/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail modal */}
      <Modal isOpen={!!viewDetail} onClose={() => setViewDetail(null)} title="Final Pay Breakdown" wide>
        {viewDetail && (() => {
          const emp = empMap[viewDetail.employeeId];
          return (
            <div className="space-y-4">
              {/* Employee header */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-700 text-sm">
                  {viewDetail.employeeName.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{viewDetail.employeeName}</p>
                  <p className="text-xs text-gray-500">{emp?.position || '—'} · {emp?.dept || '—'}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs text-gray-400">Last Working Day</p>
                  <p className="font-semibold text-gray-700">{fmtDate(viewDetail.lastWorkingDay)}</p>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-1">Earnings</p>
                <DetailRow label={`Prorated Salary (${viewDetail.daysWorkedInPeriod}d in ${viewDetail.cutOffPeriod})`} value={fmt(viewDetail.proratedSalary)}/>
                {viewDetail.allowance > 0 && <DetailRow label="Load Allowance" value={fmt(viewDetail.allowance)}/>}
                {viewDetail.otPay > 0    && <DetailRow label="Overtime Pay"    value={fmt(viewDetail.otPay)}/>}
                <DetailRow label={`Prorated 13th Month (${viewDetail.daysWorkedThisYear} working days this year)`} value={fmt(viewDetail.thirteenthMonth)}/>

                {viewDetail.totalDeductions > 0 && (
                  <>
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide px-1 pt-1">Deductions</p>
                    {viewDetail.sss > 0        && <DetailRow label="SSS"        value={`− ${fmt(viewDetail.sss)}`}        deduct/>}
                    {viewDetail.philHealth > 0 && <DetailRow label="PhilHealth" value={`− ${fmt(viewDetail.philHealth)}`} deduct/>}
                    {viewDetail.pagIbig > 0    && <DetailRow label="Pag-IBIG"   value={`− ${fmt(viewDetail.pagIbig)}`}    deduct/>}
                  </>
                )}

                <div className="border-t border-gray-200 pt-1.5 space-y-1.5">
                  <DetailRow label="Gross Final Pay"     value={fmt(viewDetail.grossFinalPay)}/>
                  {viewDetail.totalDeductions > 0 && <DetailRow label="Total Deductions" value={`− ${fmt(viewDetail.totalDeductions)}`} deduct/>}
                  <DetailRow label="Net Final Pay"       value={fmt(viewDetail.netFinalPay)} highlight/>
                </div>
              </div>

              {/* Hold status */}
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm border ${
                viewDetail.autoStatus === 'Released'        ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                viewDetail.autoStatus === 'Ready for Release' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                'bg-yellow-50 border-yellow-200 text-yellow-800'}`}>
                {viewDetail.autoStatus === 'Released'          ? <Check size={14}/> :
                 viewDetail.autoStatus === 'Ready for Release' ? <Unlock size={14}/> :
                 <Lock size={14}/>}
                {viewDetail.autoStatus === 'Released'
                  ? `Released on ${fmtDate(viewDetail.releasedOn)}`
                  : viewDetail.autoStatus === 'Ready for Release'
                    ? `30-day hold cleared — ready for release`
                    : `Held until ${viewDetail.releaseDateLabel} (${viewDetail.daysLeft} days remaining)`}
              </div>

              {viewDetail.autoStatus === 'Ready for Release' && (
                <div className="flex justify-end">
                  <button onClick={() => releasePay(viewDetail)}
                    className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium">
                    <Unlock size={14}/> Mark as Released
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GOVERNMENT DEDUCTIONS & LOANS MODAL
// ─────────────────────────────────────────────────────────────
function GovDeductionsModal({ employee, onSave, onClose }) {
  const computed    = calcGovContribs(employee.salary || 0);

  const [activeTab, setActiveTab] = useState('gov');

  // Gov IDs & contributions
  const [sssNo,     setSssNo]     = useState(employee.sssNo     || '');
  const [hdmfNo,    setHdmfNo]    = useState(employee.hdmfNo    || '');
  const [phNo,      setPhNo]      = useState(employee.philHealthNo || '');
  const [sssAmt,    setSssAmt]    = useState(employee.sssContribOverride   ?? '');
  const [hdmfAmt,   setHdmfAmt]  = useState(employee.hdmfContribOverride  ?? '');
  const [phAmt,     setPhAmt]     = useState(employee.philHealthContribOverride ?? '');

  // Gov loans
  const [sssLoanBal,     setSssLoanBal]     = useState(employee.sssLoanBalance    || '');
  const [sssLoanCutoff,  setSssLoanCutoff]  = useState(employee.sssLoanPerCutOff  || '');
  const [hdmfLoanBal,    setHdmfLoanBal]   = useState(employee.hdmfLoanBalance   || '');
  const [hdmfLoanCutoff, setHdmfLoanCutoff]= useState(employee.hdmfLoanPerCutOff || '');
  const [otherLoans,     setOtherLoans]     = useState(employee.otherLoans || []);

  // Company loan
  const [companyLoan, setCompanyLoan] = useState(employee.companyLoan || { totalAmount:'', balance:'', perCutOff:'', startDate:'' });

  const cl = (k, v) => setCompanyLoan(p => ({ ...p, [k]: v }));

  const addOtherLoan = () =>
    setOtherLoans(p => [...p, { id: uid(), name:'', totalAmount:'', balance:'', perCutOff:'' }]);
  const updateOtherLoan = (id, k, v) =>
    setOtherLoans(p => p.map(l => l.id === id ? { ...l, [k]: v } : l));
  const removeOtherLoan = (id) =>
    setOtherLoans(p => p.filter(l => l.id !== id));

  const save = () => {
    onSave({
      ...employee,
      sssNo, hdmfNo, philHealthNo: phNo,
      sssContribOverride:        sssAmt  === '' ? null : +sssAmt,
      hdmfContribOverride:       hdmfAmt === '' ? null : +hdmfAmt,
      philHealthContribOverride: phAmt   === '' ? null : +phAmt,
      sssLoanBalance:    sssLoanBal    || null,
      sssLoanPerCutOff:  sssLoanCutoff || null,
      hdmfLoanBalance:   hdmfLoanBal   || null,
      hdmfLoanPerCutOff: hdmfLoanCutoff || null,
      otherLoans,
      companyLoan: {
        totalAmount: companyLoan.totalAmount || null,
        balance:     companyLoan.balance     || null,
        perCutOff:   companyLoan.perCutOff   || null,
        startDate:   companyLoan.startDate   || null,
      },
    });
  };

  const fieldCls   = 'w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400';
  const labelCls   = 'block text-xs font-semibold text-gray-600 mb-1.5';
  const sectionHdr = (icon, title, color) => (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${color} mb-3`}>
      {icon}<span className="text-sm font-semibold">{title}</span>
    </div>
  );

  const TABS = [
    { id:'gov',     label:"Gov't IDs & Contributions", icon:<ShieldCheck size={14}/> },
    { id:'loans',   label:'Government Loans',           icon:<Banknote size={14}/> },
    { id:'company', label:'Company Salary Loan',        icon:<Building size={14}/> },
  ];

  return (
    <div className="space-y-4">
      {/* Employee header */}
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
        <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center font-bold text-orange-700 text-sm flex-shrink-0">
          {employee.name.charAt(0)}
        </div>
        <div>
          <p className="font-semibold text-gray-800 text-sm">{employee.name}</p>
          <p className="text-xs text-gray-400">{employee.position} · {employee.dept}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-gray-400">Monthly Salary</p>
          <p className="font-bold text-gray-700">{fmt(employee.salary)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === tab.id ? 'border-orange-600 text-orange-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: GOV IDs & CONTRIBUTIONS ── */}
      {activeTab === 'gov' && (
        <div className="space-y-5">
          {/* IDs */}
          {sectionHdr(<CreditCardIcon size={14} className="text-blue-600"/>, 'Government ID Numbers', 'bg-blue-50 text-blue-800')}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>SSS Number</label>
              <input value={sssNo} onChange={e => setSssNo(e.target.value)} placeholder="XX-XXXXXXX-X" className={fieldCls}/>
            </div>
            <div>
              <label className={labelCls}>HDMF (Pag-IBIG) Number</label>
              <input value={hdmfNo} onChange={e => setHdmfNo(e.target.value)} placeholder="XXXX-XXXX-XXXX" className={fieldCls}/>
            </div>
            <div>
              <label className={labelCls}>PhilHealth Number</label>
              <input value={phNo} onChange={e => setPhNo(e.target.value)} placeholder="XX-XXXXXXXXX-X" className={fieldCls}/>
            </div>
          </div>

          {/* Contributions */}
          {sectionHdr(<ShieldCheck size={14} className="text-emerald-600"/>, 'Monthly Contribution Amounts', 'bg-emerald-50 text-emerald-800')}
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <AlertCircle size={13} className="mt-0.5 flex-shrink-0"/>
            Leave blank to use the <strong className="mx-1">auto-computed</strong> amount based on salary bracket. Enter a value to override.
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label:'SSS Contribution', val:sssAmt,  setVal:setSssAmt,  computed:computed.sss,       placeholder:`Auto: ${fmt(computed.sss)}`  },
              { label:'HDMF (Pag-IBIG) Contribution', val:hdmfAmt, setVal:setHdmfAmt, computed:computed.pagIbig, placeholder:`Auto: ${fmt(computed.pagIbig)}`},
              { label:'PhilHealth Contribution', val:phAmt,  setVal:setPhAmt,  computed:computed.philHealth, placeholder:`Auto: ${fmt(computed.philHealth)}`},
            ].map(({ label, val, setVal, placeholder }) => (
              <div key={label}>
                <label className={labelCls}>{label}</label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">₱</span>
                  <input type="number" min={0} step={0.01}
                    value={val} onChange={e => setVal(e.target.value)}
                    placeholder={placeholder.replace('₱ ','').replace('₱','')}
                    className={`${fieldCls} pl-6`}/>
                </div>
                {val !== '' && (
                  <button onClick={() => setVal('')} className="mt-1 text-[10px] text-orange-600 hover:underline">Reset to auto</button>
                )}
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 space-y-1.5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Deductions Preview (Cut-Off 2)</p>
            {[
              { label:'SSS',        val: sssAmt  !== '' ? +sssAmt  : computed.sss,       base: computed.sss       },
              { label:'Pag-IBIG',   val: hdmfAmt !== '' ? +hdmfAmt : computed.pagIbig,  base: computed.pagIbig  },
              { label:'PhilHealth', val: phAmt   !== '' ? +phAmt   : computed.philHealth, base: computed.philHealth },
            ].map(({ label, val, base }) => (
              <div key={label} className="flex justify-between items-center text-sm">
                <span className="text-gray-500">{label}</span>
                <span className="font-semibold text-gray-800">
                  {fmt(val)}
                  {val !== base && <span className="ml-1.5 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-semibold">Overridden</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: GOVERNMENT LOANS ── */}
      {activeTab === 'loans' && (
        <div className="space-y-5">
          {/* SSS Loan */}
          {sectionHdr(<Banknote size={14} className="text-blue-600"/>, 'SSS Loan', 'bg-blue-50 text-blue-800')}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Outstanding Balance (PHP)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">₱</span>
                <input type="number" min={0} step={0.01} value={sssLoanBal} onChange={e => setSssLoanBal(e.target.value)} placeholder="0.00" className={`${fieldCls} pl-6`}/>
              </div>
            </div>
            <div>
              <label className={labelCls}>Deduction per Cut-Off (PHP)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">₱</span>
                <input type="number" min={0} step={0.01} value={sssLoanCutoff} onChange={e => setSssLoanCutoff(e.target.value)} placeholder="0.00" className={`${fieldCls} pl-6`}/>
              </div>
            </div>
          </div>

          {/* HDMF Loan */}
          {sectionHdr(<Banknote size={14} className="text-purple-600"/>, 'HDMF (Pag-IBIG) Loan', 'bg-purple-50 text-purple-800')}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Outstanding Balance (PHP)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">₱</span>
                <input type="number" min={0} step={0.01} value={hdmfLoanBal} onChange={e => setHdmfLoanBal(e.target.value)} placeholder="0.00" className={`${fieldCls} pl-6`}/>
              </div>
            </div>
            <div>
              <label className={labelCls}>Deduction per Cut-Off (PHP)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">₱</span>
                <input type="number" min={0} step={0.01} value={hdmfLoanCutoff} onChange={e => setHdmfLoanCutoff(e.target.value)} placeholder="0.00" className={`${fieldCls} pl-6`}/>
              </div>
            </div>
          </div>

          {/* Other Loans */}
          <div>
            <div className="flex items-center justify-between mb-2">
              {sectionHdr(<PlusCircle size={14} className="text-teal-600"/>, 'Other Loans', 'bg-teal-50 text-teal-800')}
              <button onClick={addOtherLoan}
                className="flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 px-3 py-1.5 bg-teal-50 rounded-lg border border-teal-200">
                <PlusCircle size={13}/> Add Loan
              </button>
            </div>
            {otherLoans.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl">No other loans added.</p>
            )}
            {otherLoans.map(loan => (
              <div key={loan.id} className="grid grid-cols-4 gap-2 mb-2 items-end p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="col-span-2">
                  <label className={labelCls}>Loan Name</label>
                  <input value={loan.name} onChange={e => updateOtherLoan(loan.id, 'name', e.target.value)} placeholder="e.g. Personal Loan" className={fieldCls}/>
                </div>
                <div>
                  <label className={labelCls}>Balance (PHP)</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">₱</span>
                    <input type="number" min={0} step={0.01} value={loan.balance} onChange={e => updateOtherLoan(loan.id, 'balance', e.target.value)} placeholder="0.00" className={`${fieldCls} pl-6`}/>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Per Cut-Off</label>
                  <div className="flex gap-1">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">₱</span>
                      <input type="number" min={0} step={0.01} value={loan.perCutOff} onChange={e => updateOtherLoan(loan.id, 'perCutOff', e.target.value)} placeholder="0.00" className={`${fieldCls} pl-6`}/>
                    </div>
                    <button onClick={() => removeOtherLoan(loan.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-400 flex-shrink-0"><MinusCircle size={15}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB: COMPANY SALARY LOAN ── */}
      {activeTab === 'company' && (
        <div className="space-y-4">
          {sectionHdr(<Building size={14} className="text-orange-600"/>, 'Company Salary Loan', 'bg-orange-50 text-orange-800')}

          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800">
            <AlertCircle size={13} className="mt-0.5 flex-shrink-0"/>
            The per cut-off amount is <strong className="mx-1">automatically deducted every payroll cut-off</strong> until the balance is cleared.
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Total Loan Amount (PHP)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">₱</span>
                <input type="number" min={0} step={0.01} value={companyLoan.totalAmount} onChange={e => cl('totalAmount', e.target.value)} placeholder="0.00" className={`${fieldCls} pl-6`}/>
              </div>
            </div>
            <div>
              <label className={labelCls}>Outstanding Balance (PHP)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">₱</span>
                <input type="number" min={0} step={0.01} value={companyLoan.balance} onChange={e => cl('balance', e.target.value)} placeholder="0.00" className={`${fieldCls} pl-6`}/>
              </div>
            </div>
            <div>
              <label className={labelCls}>Deduction per Cut-Off (PHP)</label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">₱</span>
                <input type="number" min={0} step={0.01} value={companyLoan.perCutOff} onChange={e => cl('perCutOff', e.target.value)} placeholder="0.00" className={`${fieldCls} pl-6`}/>
              </div>
            </div>
            <div>
              <label className={labelCls}>Loan Start Date</label>
              <input type="date" value={companyLoan.startDate} onChange={e => cl('startDate', e.target.value)} className={fieldCls}/>
            </div>
          </div>

          {/* Live deduction preview */}
          {+companyLoan.perCutOff > 0 && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-orange-50 border border-orange-200">
              <div className="text-sm text-orange-800">
                <p className="font-semibold">Auto-deduction every cut-off</p>
                <p className="text-xs text-orange-600 mt-0.5">Deducted from both Cut-Off 1 &amp; Cut-Off 2 each month</p>
              </div>
              <span className="text-lg font-bold text-orange-700">−{fmt(+companyLoan.perCutOff)}</span>
            </div>
          )}

          {/* Estimated payoff */}
          {+companyLoan.perCutOff > 0 && +companyLoan.balance > 0 && (
            <div className="text-xs text-gray-500 text-center">
              Estimated payoff: <strong className="text-gray-700">
                {Math.ceil(+companyLoan.balance / +companyLoan.perCutOff)} cut-offs
              </strong> remaining
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
        <button onClick={save} className="flex items-center gap-2 px-5 py-2 text-sm rounded-lg bg-orange-700 text-white hover:bg-orange-800 font-medium">
          <Check size={14}/> Save Deductions & Loans
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
  const [showAdd,      setShowAdd]      = useState(false);
  const [editing,      setEditing]      = useState(null);
  const [delConfirm,   setDelConfirm]   = useState(null);
  const [lwdEmp,       setLwdEmp]       = useState(null);
  const [govEmp,       setGovEmp]       = useState(null);

  const filtered = useMemo(() => state.employees.filter(e =>
    (deptFilter==='All'||e.dept===deptFilter) &&
    (typeFilter==='All'||e.type===typeFilter) &&
    (e.name.toLowerCase().includes(search.toLowerCase()) || e.id.includes(search))
  ).sort((a,b) => a.name.localeCompare(b.name)), [state.employees, search, deptFilter, typeFilter]);

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
  const saveLWD = (emp, lwd, calc) => {
    dispatch({
      type: 'SET_LAST_WORKING_DAY',
      payload: {
        id: uid(),
        employeeId:      emp.id,
        employeeName:    emp.name,
        lastWorkingDay:  lwd,
        status:          'Held',
        ...calc,
      },
    });
    toast(dispatch, `Last working day set for ${emp.name}. Final pay on hold.`, 'warning');
    setLwdEmp(null);
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
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <Badge status={emp.separated ? 'Separated' : emp.type}/>
                      {emp.separated && emp.lastWorkingDay && (
                        <span className="text-[10px] text-gray-400">LWD: {fmtDate(emp.lastWorkingDay)}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{emp.salary > 0 ? fmt(emp.salary) : <span className="text-gray-300">TBD</span>}</td>
                  <td className="px-4 py-3 text-gray-500">{emp.allowance > 0 ? <span className="text-emerald-600 font-medium">+{fmt(emp.allowance)}</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(emp.hireDate)}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono">••••{emp.bank}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 items-center flex-wrap">
                      <button onClick={()=>setEditing(emp)} className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-700" title="Edit Employee"><Edit2 size={14}/></button>
                      <button
                        onClick={()=>setGovEmp(emp)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold"
                        title="Edit Deductions & Loans">
                        <ShieldCheck size={13}/> Deductions
                      </button>
                      {!emp.separated && (
                        <button onClick={()=>setLwdEmp(emp)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" title="Set Last Working Day">
                          <UserMinus size={14}/>
                        </button>
                      )}
                      <button onClick={()=>setDelConfirm(emp)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500" title="Delete"><Trash2 size={14}/></button>
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
      <Modal isOpen={!!govEmp} onClose={()=>setGovEmp(null)} title={`Gov't Deductions & Loans — ${govEmp?.name || ''}`} wide>
        {govEmp && (
          <GovDeductionsModal
            employee={govEmp}
            onSave={emp => { updateEmp(emp); setGovEmp(null); }}
            onClose={() => setGovEmp(null)}
          />
        )}
      </Modal>
      <Modal isOpen={!!lwdEmp} onClose={()=>setLwdEmp(null)} title={`Set Last Working Day — ${lwdEmp?.name || ''}`} wide>
        {lwdEmp && (
          <LWDModal
            employee={lwdEmp}
            onSave={(lwd, calc) => saveLWD(lwdEmp, lwd, calc)}
            onClose={() => setLwdEmp(null)}
          />
        )}
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
function PayslipModal({ payslip, employee, runPeriod, releaseDateLabel, otEntries, cutOffStartDate, onClose }) {
  if (!payslip || !employee) return null;
  const slipRef = useRef();
  const [downloading, setDownloading] = useState(false);

  // OT entries for this employee, grouped by type
  // Only show Approved entries; flag entries dated before this cut-off's start (late approvals)
  const empOT = useMemo(() => {
    if (!otEntries?.length) return [];
    return otEntries.filter(e => e.employeeId === employee.id && e.status === 'Approved');
  }, [otEntries, employee.id]);

  const otByType = useMemo(() => {
    const m = {};
    empOT.forEach(e => {
      const key = e.otType;
      const isLate = cutOffStartDate && e.date < cutOffStartDate; // dated from a prior cut-off
      if (!m[key]) m[key] = { otType: key, hours: 0, otPay: 0, ndHours: 0, ndPay: 0, hasLateApproval: false };
      m[key].hours   += e.hours?.otHours || 0;
      m[key].otPay   += e.pay?.totalOTPay || 0;
      m[key].ndHours += e.hours?.ndHours || 0;
      m[key].ndPay   += e.pay?.ndPay || 0;
      if (isLate) m[key].hasLateApproval = true;
    });
    return Object.values(m);
  }, [empOT, cutOffStartDate]);

  const totalOTPay  = otByType.reduce((s, g) => s + g.otPay,  0);
  const totalNDPay  = otByType.reduce((s, g) => s + g.ndPay,  0);
  const totalNDHrs  = otByType.reduce((s, g) => s + g.ndHours, 0);

  // If OT was already baked into grossPay via calcPayslip (otPayDirect path), don't add it again.
  // payslip.overtimePay > 0 AND empOT.length > 0 → OT already in grossPay.
  // Legacy payslips (no OT entries, or entries not yet approved) still add from empOT.
  const otBakedIn    = payslip.overtimePay > 0 && empOT.length > 0;
  const adjustedGross = otBakedIn
    ? payslip.grossPay
    : payslip.grossPay + totalOTPay + totalNDPay;

  // Deductions — always shown; gov deductions are 0 on Cut-Off 1
  const isCO1        = payslip.cutOff === 1;
  const sssAmt       = isCO1 ? 0 : (payslip.sss       || 0);
  const phAmt        = isCO1 ? 0 : (payslip.philHealth || 0);
  const hdmfAmt      = isCO1 ? 0 : (payslip.pagIbig    || 0);
  const sssLoan      = payslip.sssLoan     || 0;
  const hdmfLoan     = payslip.hdmfLoan    || 0;
  const companyLoan  = payslip.companyLoan || 0;
  const otherLoansAmt= typeof payslip.otherLoans === 'number' ? payslip.otherLoans : 0;
  const totalDeductions = sssAmt + phAmt + hdmfAmt + sssLoan + hdmfLoan + companyLoan + otherLoansAmt;
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
                    <div className="flex justify-between items-baseline py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-600 flex items-center gap-1.5 flex-wrap">
                        {typeInfo?.label || g.otType} ({g.hours.toFixed(2)} hrs)
                        {g.hasLateApproval && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap">
                            ↩ prev. cut-off
                          </span>
                        )}
                      </span>
                      <span className="text-sm font-medium tabular-nums text-emerald-600">+{fmt(g.otPay)}</span>
                    </div>
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
              {payslip.holidayPremium > 0 && (
                <Row label="Holiday Premium Pay" value={`+${fmt(payslip.holidayPremium)}`} color="text-emerald-600"/>
              )}
              {payslip.holidayDeduction > 0 && (
                <Row label="Special Holiday (No Work)" value={`-${fmt(payslip.holidayDeduction)}`} color="text-red-500"/>
              )}

              <div className="border-t border-gray-200 mt-1 pt-2">
                <Row label="Gross Salary" value={fmt(adjustedGross)} color="text-emerald-700" bold/>
              </div>
            </div>
          </div>

          {/* DEDUCTIONS — gov contributions + all loans */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <SectionHead color="bg-red-50 text-red-800 border-b border-red-100">Deductions</SectionHead>
            <div className="px-4 py-2">
              {/* Gov't contributions */}
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mt-1 mb-0.5">Gov't Contributions</p>
              <Row label="SSS"
                value={sssAmt > 0 ? `-${fmt(sssAmt)}` : '₱0.00'}
                color={sssAmt > 0 ? 'text-red-500' : 'text-gray-300'}/>
              <Row label="HDMF / Pag-IBIG"
                value={hdmfAmt > 0 ? `-${fmt(hdmfAmt)}` : '₱0.00'}
                color={hdmfAmt > 0 ? 'text-red-500' : 'text-gray-300'}/>
              <Row label="PhilHealth"
                value={phAmt > 0 ? `-${fmt(phAmt)}` : '₱0.00'}
                color={phAmt > 0 ? 'text-red-500' : 'text-gray-300'}/>
              {/* Gov't loans */}
              {(sssLoan > 0 || hdmfLoan > 0) && (
                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mt-2 mb-0.5">Gov't Loans</p>
              )}
              {sssLoan > 0 && (
                <Row label="SSS Loan" value={`-${fmt(sssLoan)}`} color="text-red-500"/>
              )}
              {hdmfLoan > 0 && (
                <Row label="HDMF Loan" value={`-${fmt(hdmfLoan)}`} color="text-red-500"/>
              )}
              {/* Company & other loans */}
              {(companyLoan > 0 || otherLoansAmt > 0) && (
                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mt-2 mb-0.5">Company Loans</p>
              )}
              {companyLoan > 0 && (
                <Row label="Company Salary Loan" value={`-${fmt(companyLoan)}`} color="text-red-500"/>
              )}
              {otherLoansAmt > 0 && (
                <Row label="Other Loans" value={`-${fmt(otherLoansAmt)}`} color="text-red-500"/>
              )}
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

  const [processing,      setProcessing]      = useState(false);
  const [preview,         setPreview]         = useState(null);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [reimbursements,  setReimbursements]  = useState({}); // { [empId]: amount }

  // Derive schedule whenever month/year changes
  const schedule = useMemo(() => getCutOffSchedule(selYear, selMonth), [selYear, selMonth]);
  const activeCO = selCutOff === 1 ? schedule.cutOff1 : schedule.cutOff2;

  // Reset preview & reimbursements when selection changes
  useEffect(() => { setPreview(null); setReimbursements({}); }, [selYear, selMonth, selCutOff]);

  // Build attendance map: count approved absences & late minutes within the active cut-off
  const attendanceMap = useMemo(() => {
    // Unpaid leave types that should deduct from salary
    const UNPAID_TYPES = new Set(
      LEAVE_TYPES.filter(l => !l.paid).map(l => l.id)
    ); // 'absent','late','personal','emergency','bereavement','other'

    const m = {};
    state.attendance.forEach(a => {
      const isApproved = !a.status || a.status === 'Approved';
      const inRange    = a.date >= activeCO.startDate && a.date <= activeCO.endDate;
      if (!isApproved || !inRange) return;
      if (!m[a.employeeId]) m[a.employeeId] = { absences: 0, lateMinutes: 0 };

      const type = (a.type || '').toLowerCase().trim();

      if (type === 'late') {
        // Tardiness — deduct based on minutes late
        m[a.employeeId].lateMinutes += (a.minutes || 0);
      } else if (UNPAID_TYPES.has(type) && type !== 'late') {
        // Unpaid absence (absent, personal, emergency, bereavement, other)
        m[a.employeeId].absences += (a.days || 1);
      }
      // Paid leave types (sick, vacation, sil, maternity, paternity) → no deduction
    });
    return m;
  }, [state.attendance, activeCO]);

  const buildPreview = (reimb = reimbursements) => {
    // Collect Approved OT entries for this cut-off (by date OR assigned to this cut-off)
    const approvedOT = state.otEntries.filter(e =>
      e.status === 'Approved' &&
      !e.includedInPayrollId &&
      (
        (e.date >= activeCO.startDate && e.date <= activeCO.endDate) ||
        e.assignedCutOffStart === activeCO.startDate
      )
    );

    // Dynamic Mon–Sat working days — exclude PH holidays + any holidays logged in Holiday Pay tab
    const loggedHolidayDates = [...new Set(
      (state.holidayEntries || [])
        .filter(e => e.date >= activeCO.startDate && e.date <= activeCO.endDate && e.status === 'Approved')
        .map(e => e.date)
    )];
    const periodWorkingDays = countWorkingDays(activeCO.startDate, activeCO.endDate, loggedHolidayDates);

    const rows = state.employees.map(emp => {
      const att        = attendanceMap[emp.id] || {};
      const reimb_amt  = parseFloat(reimb[emp.id] || 0);
      const empOT      = approvedOT.filter(e => e.employeeId === emp.id);
      const otPay      = empOT.reduce((s, e) => s + (e.pay?.total || 0), 0);
      const otIds      = empOT.map(e => e.id);
      const dailyRate  = (emp.salary || 0) / 26;
      const holPay     = computeHolidayPay(state.holidayEntries, activeCO.startDate, activeCO.endDate, emp.id, dailyRate);
      const calc       = calcPayslip(emp, periodWorkingDays, att.absences||0, att.lateMinutes||0, 0, selCutOff, reimb_amt, otPay, undefined, holPay.premium, holPay.deduction);
      return { emp, calc, otIds };
    });
    setPreview(rows);
  };

  // Live-recompute a single row when its reimbursement changes
  const updateReimbursement = (empId, value) => {
    const updated = { ...reimbursements, [empId]: value };
    setReimbursements(updated);
    if (preview) buildPreview(updated);
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
      const payrollId = uid();
      const payslips  = preview.map(({ emp, calc }) => ({
        id: uid(), employeeId: emp.id, ...calc,
        period: activeCO.periodLabel, date: activeCO.endDate, status: 'Paid',
      }));
      dispatch({
        type: 'ADD_PAYROLL_RUN',
        payload: {
          id:               payrollId,
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
      // Mark all included OT entries so they won't be double-counted
      const includedOTIds = preview.flatMap(r => r.otIds || []);
      if (includedOTIds.length > 0) {
        dispatch({ type: 'MARK_OT_INCLUDED', ids: includedOTIds, payrollId });
      }
      toast(dispatch, `Payroll for "${activeCO.periodLabel}" processed — Release: ${activeCO.releaseDateLabel}`);
      setProcessing(false);
      setPreview(null);
    }, 2000);
  };

  const totalGross  = preview ? preview.reduce((s,r)=>s+r.calc.grossPay,0)         : 0;
  const totalNet    = preview ? preview.reduce((s,r)=>s+r.calc.netPay,0)           : 0;
  const totalDeduct = preview ? preview.reduce((s,r)=>s+r.calc.totalDeductions,0)  : 0;
  const totalReimb  = preview ? preview.reduce((s,r)=>s+(r.calc.reimbursement||0),0) : 0;

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

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={DollarSign} label="Total Gross Pay"      value={fmt(totalGross)}  color="indigo"/>
            <StatCard icon={Banknote}   label="Total Reimbursements" value={fmt(totalReimb)}  color="green"/>
            <StatCard icon={TrendingUp} label="Total Deductions"     value={fmt(totalDeduct)} color="amber"/>
            <StatCard icon={DollarSign} label="Total Net Pay"        value={fmt(totalNet)}    color="green"/>
          </div>

          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-teal-50 border border-teal-200 text-sm text-teal-800">
            <Banknote size={14} className="flex-shrink-0"/>
            <span>Enter any <strong>reimbursements</strong> in the table below — amounts are added to gross pay and update totals in real time.</span>
          </div>

          {/* OT / Attendance approval status notice */}
          {(() => {
            const pendingOT  = state.otEntries.filter(e => (!e.status || e.status === 'Pending') && !e.includedInPayrollId &&
              ((e.date >= activeCO.startDate && e.date <= activeCO.endDate) || e.assignedCutOffStart === activeCO.startDate)).length;
            const pendingAtt = state.attendance.filter(a => a.status === 'Pending' && a.date >= activeCO.startDate && a.date <= activeCO.endDate).length;
            const approvedOT = state.otEntries.filter(e => e.status === 'Approved' && !e.includedInPayrollId &&
              ((e.date >= activeCO.startDate && e.date <= activeCO.endDate) || e.assignedCutOffStart === activeCO.startDate)).length;
            return (
              <div className="flex flex-wrap gap-2">
                {approvedOT > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
                    <Check size={13} className="flex-shrink-0"/>
                    <span><strong>{approvedOT}</strong> approved OT {approvedOT === 1 ? 'entry' : 'entries'} will be included in this payroll.</span>
                  </div>
                )}
                {pendingOT > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
                    <AlertCircle size={13} className="flex-shrink-0"/>
                    <span><strong>{pendingOT}</strong> OT {pendingOT === 1 ? 'entry' : 'entries'} still Pending — not included until approved.</span>
                  </div>
                )}
                {pendingAtt > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
                    <AlertCircle size={13} className="flex-shrink-0"/>
                    <span><strong>{pendingAtt}</strong> attendance record{pendingAtt !== 1 ? 's' : ''} still Pending — deductions won't apply until approved.</span>
                  </div>
                )}
              </div>
            );
          })()}

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
                    <th className="px-4 py-3 text-left font-medium text-orange-700">OT Pay</th>
                    <th className="px-4 py-3 text-left font-medium text-teal-700">Reimbursement</th>
                    <th className="px-4 py-3 text-left font-medium">Gross Pay</th>
                    <th className="px-4 py-3 text-left font-medium">Absences</th>
                    <th className="px-4 py-3 text-left font-medium">Late</th>
                    {selCutOff === 2 && <th className="px-4 py-3 text-left font-medium">Deductions</th>}
                    <th className="px-4 py-3 text-left font-medium">Net Pay</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {preview.map(({ emp, calc, otIds }) => (
                    <tr key={emp.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-medium text-gray-800">{emp.name}</td>
                      <td className="px-4 py-3 text-gray-500">{emp.dept}</td>
                      <td className="px-4 py-3 text-gray-700 font-medium">{fmt(calc.baseSalary)}</td>
                      {selCutOff === 2 && (
                        <td className="px-4 py-3 text-emerald-600">
                          {calc.allowance > 0 ? `+${fmt(calc.allowance)}` : <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      <td className="px-4 py-3 text-orange-600 font-medium">
                        {calc.overtimePay > 0
                          ? <span>+{fmt(calc.overtimePay)}<span className="ml-1 text-[10px] text-orange-400">({otIds?.length || 0} entr{(otIds?.length || 0) === 1 ? 'y' : 'ies'})</span></span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">₱</span>
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            placeholder="0.00"
                            value={reimbursements[emp.id] || ''}
                            onChange={e => updateReimbursement(emp.id, e.target.value)}
                            className="w-28 pl-6 pr-2 py-1.5 text-sm rounded-lg border border-teal-200 bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-400 text-teal-800 font-medium placeholder:text-gray-300"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-emerald-600 font-medium">
                        {fmt(calc.grossPay)}
                        {calc.reimbursement > 0 && (
                          <span className="ml-1 text-xs text-teal-600">(+{fmt(calc.reimbursement)} reimb.)</span>
                        )}
                      </td>
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
            cutOffStartDate={activeCO.startDate}
            otEntries={state.otEntries.filter(e =>
              e.status === 'Approved' &&
              (
                (e.date >= activeCO.startDate && e.date <= activeCO.endDate) ||
                e.assignedCutOffStart === activeCO.startDate
              )
            )}
            onClose={()=>setSelectedPayslip(null)}
          />
        )}
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LEAVE FORM
// ─────────────────────────────────────────────────────────────
function LeaveForm({ employees, attendance, onSave, onClose }) {
  const [form, setForm] = useState({ employeeId:'', date:today(), type:'sick', days:1, minutes:0, reason:'', status:'Pending' });
  const [errs, setErrs] = useState({});
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const selectedEmp  = employees.find(e => e.id === form.employeeId);
  const lt           = LEAVE_TYPES.find(t => t.id === form.type);
  const silInfo      = selectedEmp ? calcSIL(selectedEmp, attendance, today()) : null;
  const isSIL        = form.type === 'sil';
  const silBlocked   = isSIL && silInfo && !silInfo.eligible;
  const silInsuff    = isSIL && silInfo && silInfo.eligible && (+form.days > silInfo.balance);

  const validate = () => {
    const e = {};
    if (!form.employeeId) e.employeeId = 'Select an employee';
    if (!form.date)       e.date       = 'Date is required';
    if (silBlocked)       e.type       = `Not yet eligible for SIL — eligible on ${fmtDate(silInfo.eligibleDate)} (${silInfo.daysLeft} days away)`;
    else if (silInsuff)   e.type       = `Insufficient SIL balance — only ${silInfo.balance} day(s) remaining`;
    if (lt?.daysField && (!form.days || +form.days < 0.5)) e.days = 'Minimum 0.5 day';
    if (!lt?.daysField   && (!form.minutes || +form.minutes < 1)) e.minutes = 'Enter minutes late';
    setErrs(e); return !Object.keys(e).length;
  };

  return (
    <div className="space-y-4">
      {/* Employee */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Employee</label>
        <select value={form.employeeId} onChange={e => f('employeeId', e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400">
          <option value="">— Select Employee —</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.dept})</option>)}
        </select>
        {errs.employeeId && <p className="text-xs text-red-500 mt-1">{errs.employeeId}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Date</label>
          <input type="date" value={form.date} onChange={e => f('date', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400"/>
          {errs.date && <p className="text-xs text-red-500 mt-1">{errs.date}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
          <select value={form.status} onChange={e => f('status', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option>Approved</option><option>Pending</option><option>Rejected</option>
          </select>
        </div>
      </div>

      {/* Leave type dropdown */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Leave / Absence Type</label>
        <select value={form.type} onChange={e => f('type', e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400">
          {LEAVE_TYPES.map(lt => (
            <option key={lt.id} value={lt.id}>
              {lt.label}{lt.paid ? ' (Paid)' : ''}
            </option>
          ))}
        </select>
        {errs.type && (
          <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            <AlertCircle size={13} className="mt-0.5 flex-shrink-0"/>{errs.type}
          </div>
        )}
      </div>

      {/* SIL status banner */}
      {isSIL && silInfo && (
        <div className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-sm border ${
          silBlocked  ? 'bg-red-50 border-red-200 text-red-800' :
          silInsuff   ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                        'bg-purple-50 border-purple-200 text-purple-800'}`}>
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0"/>
          {silBlocked
            ? `Not eligible for SIL — 1 year of service required. Eligible on ${fmtDate(silInfo.eligibleDate)}.`
            : `SIL Balance: ${silInfo.balance} of ${silInfo.maxPerYear} days available (${silInfo.accrued} accrued · ${silInfo.used} used this year)`}
        </div>
      )}

      {/* Days / Minutes */}
      {lt?.daysField ? (
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Number of Days</label>
          <input type="number" value={form.days} onChange={e => f('days', e.target.value)}
            min={0.5} max={60} step={0.5}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400"/>
          {errs.days && <p className="text-xs text-red-500 mt-1">{errs.days}</p>}
        </div>
      ) : (
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Minutes Late</label>
          <input type="number" value={form.minutes} onChange={e => f('minutes', e.target.value)}
            min={1} max={480}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400"/>
          {errs.minutes && <p className="text-xs text-red-500 mt-1">{errs.minutes}</p>}
        </div>
      )}

      {/* Reason */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes / Reason</label>
        <textarea value={form.reason} onChange={e => f('reason', e.target.value)}
          rows={2} placeholder="Optional details…"
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"/>
      </div>

      <div className="flex gap-3 justify-end pt-1">
        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">Cancel</button>
        <button onClick={() => { if (validate()) onSave({ ...form, days:+form.days||1, minutes:+form.minutes||0 }); }}
          disabled={silBlocked}
          className="px-5 py-2 text-sm rounded-lg bg-orange-700 text-white hover:bg-orange-800 font-medium disabled:opacity-50">
          Save Record
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LEAVE RECORDS TAB
// ─────────────────────────────────────────────────────────────
function LeaveRecordsTab({ records, empMap, employees, search, setSearch, typeFilter, setTypeFilter, empFilter, setEmpFilter, onDelete, onApprove, onReject }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50"/>
        </div>
        <select value={empFilter} onChange={e => setEmpFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50">
          <option value="all">All Employees</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50">
          <option value="all">All Types</option>
          {LEAVE_TYPES.map(lt => <option key={lt.id} value={lt.id}>{lt.label}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                {['Employee','Dept','Date','Type','Days / Minutes','With Pay','Reason','Status',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.map(rec => {
                const emp = empMap[rec.employeeId];
                const lt  = LEAVE_TYPES.find(t => t.id === rec.type || t.label === rec.type) || { label:rec.type, badge:'bg-gray-100 text-gray-600', paid:false };
                return (
                  <tr key={rec.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-800">{emp?.name || rec.employeeId}</td>
                    <td className="px-4 py-3 text-gray-500">{emp?.dept || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(rec.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${lt.badge}`}>{lt.label}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {lt.daysField === false
                        ? `${rec.minutes || 0} min late`
                        : `${rec.days || 1} day${(rec.days || 1) !== 1 ? 's' : ''}`}
                    </td>
                    <td className="px-4 py-3">
                      {lt.paid
                        ? <span className="text-emerald-600 font-medium text-xs">✓ Paid</span>
                        : <span className="text-gray-400 text-xs">Unpaid</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-[160px] truncate" title={rec.reason}>{rec.reason || '—'}</td>
                    <td className="px-4 py-3"><Badge status={rec.status || 'Approved'}/></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {(rec.status === 'Pending' || !rec.status) && (
                          <button
                            onClick={() => onApprove && onApprove(rec.id)}
                            title="Approve"
                            className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-medium">
                            <Check size={11}/> Approve
                          </button>
                        )}
                        {rec.status === 'Approved' && (
                          <button
                            onClick={() => onReject && onReject(rec.id)}
                            title="Revoke"
                            className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-yellow-50 text-yellow-700 hover:bg-yellow-100 text-xs font-medium">
                            <X size={11}/> Revoke
                          </button>
                        )}
                        <button onClick={() => onDelete(rec.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!records.length && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SIL LEDGER TAB
// ─────────────────────────────────────────────────────────────
function SILLedgerTab({ employees, attendance, todayStr }) {
  const silData = useMemo(() =>
    employees.map(emp => ({ emp, sil: calcSIL(emp, attendance, todayStr) }))
      .sort((a, b) => {
        if (a.sil.eligible !== b.sil.eligible) return a.sil.eligible ? -1 : 1;
        return a.emp.name.localeCompare(b.emp.name);
      }),
    [employees, attendance, todayStr]
  );
  const eligible = silData.filter(d => d.sil.eligible).length;

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-purple-50 border border-purple-200 text-sm text-purple-800">
        <AlertCircle size={15} className="mt-0.5 flex-shrink-0"/>
        <span>
          <strong>Service Incentive Leave (SIL)</strong> — under the Philippine Labor Code, employees are entitled to <strong>5 days with pay per year</strong> after completing <strong>1 year of continuous service</strong>. SIL accrues at <strong>≈ 0.42 days/month</strong> from the eligibility date.
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3">
          <p className="text-2xl font-bold text-purple-700">{eligible}</p>
          <p className="text-xs text-purple-600 font-medium">Eligible Employees</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-2xl font-bold text-gray-600">{employees.length - eligible}</p>
          <p className="text-xs text-gray-500 font-medium">Not Yet Eligible</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <p className="text-2xl font-bold text-blue-700">
            {silData.filter(d => d.sil.eligible).reduce((s, d) => s + d.sil.used, 0)}
          </p>
          <p className="text-xs text-blue-600 font-medium">SIL Days Used (YTD)</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <p className="text-2xl font-bold text-emerald-700">
            {parseFloat(silData.filter(d => d.sil.eligible).reduce((s, d) => s + d.sil.balance, 0).toFixed(2))}
          </p>
          <p className="text-xs text-emerald-600 font-medium">Total SIL Balance</p>
        </div>
      </div>

      {/* Per-employee table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                {['Employee','Dept','Hire Date','Eligible From','Eligibility','Accrued','Used','Balance','Progress'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {silData.map(({ emp, sil }) => (
                <tr key={emp.id} className={`hover:bg-gray-50/50 ${!sil.eligible ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">{emp.name}</td>
                  <td className="px-4 py-3 text-gray-500">{emp.dept}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(emp.hireDate)}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(sil.eligibleDate)}</td>
                  <td className="px-4 py-3">
                    {sil.eligible
                      ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                          <Check size={10}/> Eligible
                        </span>
                      : <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          {sil.daysLeft}d to go
                        </span>}
                  </td>
                  <td className="px-4 py-3 font-semibold text-purple-700">{sil.eligible ? sil.accrued : '—'}</td>
                  <td className="px-4 py-3">
                    {sil.eligible
                      ? <span className={sil.used > 0 ? 'text-red-600 font-medium' : 'text-gray-400'}>{sil.used > 0 ? sil.used : '—'}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-800">{sil.eligible ? sil.balance : '—'}</td>
                  <td className="px-4 py-3">
                    {sil.eligible ? (
                      <div className="flex items-center gap-2 min-w-24">
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="bg-purple-500 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (sil.balance / sil.maxPerYear) * 100)}%` }}/>
                        </div>
                        <span className="text-xs text-purple-600 font-semibold whitespace-nowrap">{sil.balance}/{sil.maxPerYear}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 min-w-24">
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div className="bg-gray-300 h-2 rounded-full"
                            style={{ width: `${Math.max(0, 100 - (sil.daysLeft / 365) * 100)}%` }}/>
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">{sil.daysLeft}d</span>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// TARDINESS LOG TAB
// ─────────────────────────────────────────────────────────────
function TardinessTab({ records, empMap, onDelete }) {
  const sorted     = [...records].sort((a, b) => b.date.localeCompare(a.date));
  const totalMins  = sorted.reduce((s, r) => s + (r.minutes || 0), 0);
  const hrs        = Math.floor(totalMins / 60);
  const mins       = totalMins % 60;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
        <Timer size={14}/>
        <span><strong>{sorted.length}</strong> tardiness records · Total time lost: <strong>{hrs}h {mins}m</strong></span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                {['Employee','Department','Date','Minutes Late','Deduction','Reason',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sorted.map(rec => {
                const emp       = empMap[rec.employeeId];
                const dailyRate = emp ? (emp.salary || 0) / 26 : 0;
                const deduction = (dailyRate / 8 / 60) * (rec.minutes || 0);
                return (
                  <tr key={rec.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-800">{emp?.name || rec.employeeId}</td>
                    <td className="px-4 py-3 text-gray-500">{emp?.dept || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(rec.date)}</td>
                    <td className="px-4 py-3"><span className="font-semibold text-yellow-700">{rec.minutes || 0} min</span></td>
                    <td className="px-4 py-3 text-red-600 font-medium">−{fmt(deduction)}</td>
                    <td className="px-4 py-3 text-gray-500">{rec.reason || '—'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => onDelete(rec.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 size={14}/></button>
                    </td>
                  </tr>
                );
              })}
              {!sorted.length && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No tardiness records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// HOLIDAY PAY TAB
// ─────────────────────────────────────────────────────────────
const HOLIDAY_TYPES = [
  { id:'reghol',  label:'Regular Holiday',          color:'bg-red-100 text-red-700'    },
  { id:'spechol', label:'Special Non-Working',       color:'bg-amber-100 text-amber-700'},
  { id:'specwork',label:'Special Working Holiday',   color:'bg-blue-100 text-blue-700'  },
];

function HolidayPayTab({ employees, entries, empMap, onAdd, onUpdate, onDelete }) {
  const emptyForm = { employeeId:'', date:'', holidayType:'reghol', worked:true, hoursWorked:8, notes:'' };
  const [form,       setForm]       = useState(emptyForm);
  const [showForm,   setShowForm]   = useState(false);
  const [editEntry,  setEditEntry]  = useState(null);
  const [search,     setSearch]     = useState('');

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const holiday     = form.date ? PH_HOLIDAYS[form.date] : null;
  const autoType    = holiday ? (holiday.type === 'reghol' ? 'reghol' : 'spechol') : form.holidayType;
  const dailyRateEx = employees.find(e => e.id === form.employeeId)?.salary / 26 || 0;
  const hourlyRate  = dailyRateEx / 8;
  const hours       = +(form.hoursWorked || 8);

  // Preview computed pay
  const previewPay = () => {
    const ht = holiday ? autoType : form.holidayType;
    if (ht === 'reghol')  return form.worked ? hourlyRate * hours : 0;
    if (ht === 'spechol') return form.worked ? hourlyRate * hours * 0.30 : -(dailyRateEx);
    if (ht === 'specwork') return form.worked ? 0 : -(dailyRateEx);
    return 0;
  };
  const pay = previewPay();

  function handleSubmit(e) {
    e.preventDefault();
    const ht = holiday ? autoType : form.holidayType;
    const entry = {
      id: editEntry?.id || uid(),
      employeeId: form.employeeId,
      date: form.date,
      holidayName: holiday?.name || '—',
      holidayType: ht,
      worked: form.worked,
      hoursWorked: form.worked ? +form.hoursWorked : 0,
      notes: form.notes,
      status: 'Approved',
    };
    editEntry ? onUpdate(entry) : onAdd(entry);
    setForm(emptyForm); setShowForm(false); setEditEntry(null);
  }

  function openEdit(entry) {
    setEditEntry(entry);
    setForm({ employeeId: entry.employeeId, date: entry.date, holidayType: entry.holidayType, worked: entry.worked, hoursWorked: entry.hoursWorked || 8, notes: entry.notes || '' });
    setShowForm(true);
  }

  const filtered = entries.filter(e => {
    const emp = empMap[e.employeeId];
    return !search || (emp?.name || '').toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => b.date.localeCompare(a.date));

  const fieldCls = 'w-full px-3 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-orange-400';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">Holiday Pay Log</h3>
          <p className="text-xs text-gray-400 mt-0.5">Log holiday work/no-work entries — reflected automatically in payroll</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditEntry(null); setForm(emptyForm); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-orange-700 hover:bg-orange-800 text-white rounded-xl text-sm font-semibold transition">
          <Plus size={14}/> Log Holiday Pay
        </button>
      </div>

      {/* Rules reminder */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        {[
          { label:'Regular Holiday', rules:['Not Worked → 100% (in salary, no addition)','Worked → 200% (add 100% premium)'], color:'bg-red-50 border-red-200 text-red-800' },
          { label:'Special Non-Working', rules:['Not Worked → No Work No Pay (deduct)','Worked → 130% (add 30% premium)'], color:'bg-amber-50 border-amber-200 text-amber-800' },
          { label:'Special Working', rules:['Not Worked → No Work No Pay (deduct)','Worked → Regular Pay (no premium)'], color:'bg-blue-50 border-blue-200 text-blue-800' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border p-3 ${card.color}`}>
            <p className="font-bold mb-1">{card.label}</p>
            {card.rules.map(r => <p key={r} className="opacity-80">• {r}</p>)}
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employee…"
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"/>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No holiday pay entries yet.</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                {['Employee','Date','Holiday','Type','Worked?','Hours','Pay Adjustment','Status',''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(entry => {
                const emp   = empMap[entry.employeeId];
                const ht    = HOLIDAY_TYPES.find(t => t.id === entry.holidayType);
                const dr    = (emp?.salary || 0) / 26;
                const hr    = dr / 8;
                const hrs   = +(entry.hoursWorked || 8);
                let payAdj  = 0;
                if (entry.holidayType === 'reghol')   payAdj = entry.worked ? hr * hrs : 0;
                if (entry.holidayType === 'spechol')  payAdj = entry.worked ? hr * hrs * 0.30 : -dr;
                if (entry.holidayType === 'specwork') payAdj = entry.worked ? 0 : -dr;
                return (
                  <tr key={entry.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-800">{emp?.name || entry.employeeId}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fmtDate(entry.date)}</td>
                    <td className="px-4 py-3 text-gray-600">{entry.holidayName || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ht?.color || 'bg-gray-100 text-gray-600'}`}>
                        {ht?.label || entry.holidayType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${entry.worked ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {entry.worked ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{entry.worked ? `${entry.hoursWorked || 8}h` : '—'}</td>
                    <td className={`px-4 py-3 font-semibold ${payAdj >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {payAdj === 0 ? '₱0.00' : (payAdj > 0 ? '+' : '') + fmt(payAdj)}
                    </td>
                    <td className="px-4 py-3"><Badge status={entry.status || 'Approved'}/></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(entry)} className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-400 hover:text-orange-700"><Edit2 size={13}/></button>
                        <button onClick={() => onDelete(entry.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500"><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      <Modal isOpen={showForm} onClose={() => { setShowForm(false); setEditEntry(null); }} title={editEntry ? 'Edit Holiday Entry' : 'Log Holiday Pay'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Employee</label>
            <select value={form.employeeId} onChange={e => f('employeeId', e.target.value)} required className={fieldCls}>
              <option value="">Select employee…</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Holiday Date</label>
            <input type="date" value={form.date} onChange={e => f('date', e.target.value)} required className={fieldCls}/>
            {holiday && (
              <p className="mt-1.5 text-xs text-orange-700 font-medium">📅 {holiday.name} — {holiday.type === 'reghol' ? 'Regular Holiday' : 'Special Non-Working'}</p>
            )}
            {form.date && !holiday && (
              <p className="mt-1.5 text-xs text-gray-400">Not a PH holiday. Select holiday type manually below.</p>
            )}
          </div>

          {/* Holiday Type (manual override if not in PH_HOLIDAYS) */}
          {!holiday && form.date && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Holiday Type</label>
              <select value={form.holidayType} onChange={e => f('holidayType', e.target.value)} className={fieldCls}>
                {HOLIDAY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
          )}

          {/* Worked? */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Did the employee work on this holiday?</label>
            <div className="flex gap-3">
              {[true, false].map(v => (
                <button type="button" key={String(v)}
                  onClick={() => f('worked', v)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition ${form.worked === v ? (v ? 'bg-green-600 text-white border-green-600' : 'bg-gray-500 text-white border-gray-500') : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  {v ? 'Yes — Worked' : 'No — Did not work'}
                </button>
              ))}
            </div>
          </div>

          {/* Hours worked */}
          {form.worked && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Hours Worked</label>
              <input type="number" min={1} max={24} step={0.5} value={form.hoursWorked}
                onChange={e => f('hoursWorked', e.target.value)} required className={fieldCls}/>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Notes (optional)</label>
            <input value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Optional notes…" className={fieldCls}/>
          </div>

          {/* Pay Preview */}
          {form.employeeId && form.date && (
            <div className={`rounded-xl px-4 py-3 text-sm border ${pay >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Pay Adjustment Preview</p>
              <p className={`font-bold text-base ${pay >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                {pay === 0 ? '₱0.00 (no change to pay)' : (pay > 0 ? '+' : '') + fmt(pay)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {pay > 0 ? 'Holiday premium will be added to payroll' : pay < 0 ? 'Day will be deducted (no work no pay)' : 'Regular holiday, salary covers this day'}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowForm(false); setEditEntry(null); }}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl bg-orange-700 text-white text-sm font-semibold hover:bg-orange-800">
              {editEntry ? 'Save Changes' : 'Log Entry'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ATTENDANCE & LEAVE (main page)
// ─────────────────────────────────────────────────────────────
function AttendanceLeave() {
  const { state, dispatch } = useApp();
  const [activeTab,  setActiveTab]  = useState('records');
  const [showForm,   setShowForm]   = useState(false);
  const [search,     setSearch]     = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [empFilter,  setEmpFilter]  = useState('all');

  const empMap   = useMemo(() => Object.fromEntries(state.employees.map(e => [e.id, e])), [state.employees]);
  const todayStr = today();

  // Normalize old Absent/Late records to new IDs for display
  const normalizeType = (t) => {
    if (t === 'Absent') return 'absent';
    if (t === 'Late')   return 'late';
    return t;
  };

  const allRecords = useMemo(() =>
    state.attendance.map(r => ({ ...r, type: normalizeType(r.type) }))
  , [state.attendance]);

  const tardinessRecords = useMemo(() => allRecords.filter(r => r.type === 'late'), [allRecords]);

  const filteredRecords = useMemo(() => allRecords.filter(r => {
    const emp = empMap[r.employeeId];
    return (empFilter  === 'all' || r.employeeId === empFilter)
        && (typeFilter === 'all' || r.type === typeFilter)
        && (!search || (emp && emp.name.toLowerCase().includes(search.toLowerCase())));
  }).sort((a, b) => b.date.localeCompare(a.date)), [allRecords, empMap, search, typeFilter, empFilter]);

  // Summary stats
  const todayAbsent = allRecords.filter(r => r.date === todayStr && r.type === 'absent').length;
  const todayLate   = allRecords.filter(r => r.date === todayStr && r.type === 'late').length;
  const totalLeave  = allRecords.filter(r => r.type !== 'absent' && r.type !== 'late').length;

  const TABS = [
    { id:'records',   label:'Leave Records'  },
    { id:'sil',       label:'SIL Ledger'     },
    { id:'tardiness', label:'Tardiness Log'  },
    { id:'holiday',   label:'Holiday Pay'    },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Attendance & Leave</h1>
          <p className="text-sm text-gray-500">All leave types · SIL tracking · Tardiness management</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-700 text-white rounded-xl text-sm font-medium hover:bg-orange-800 shadow-sm">
          <Plus size={16}/> Log Leave / Absence
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={FileText}    label="Leave Records"   value={totalLeave}                color="indigo"/>
        <StatCard icon={Clock}       label="Tardiness Records" value={tardinessRecords.length} color="amber"/>
        <StatCard icon={AlertCircle} label="Absent Today"    value={todayAbsent}               color="pink"/>
        <StatCard icon={Timer}       label="Late Today"      value={todayLate}                 color="amber"/>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-orange-600 text-orange-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
              {tab.id === 'sil' && (
                <span className="ml-1.5 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-semibold">SIL</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'records' && (
        <LeaveRecordsTab
          records={filteredRecords} empMap={empMap} employees={state.employees}
          search={search} setSearch={setSearch}
          typeFilter={typeFilter} setTypeFilter={setTypeFilter}
          empFilter={empFilter}   setEmpFilter={setEmpFilter}
          onDelete={id => { dispatch({ type:'DELETE_ATTENDANCE', id }); toast(dispatch,'Record removed','warning'); }}
          onApprove={id => { dispatch({ type:'UPDATE_ATTENDANCE_STATUS', id, status:'Approved' }); toast(dispatch,'Record approved'); }}
          onReject={id => { dispatch({ type:'UPDATE_ATTENDANCE_STATUS', id, status:'Pending' }); toast(dispatch,'Record set back to Pending','warning'); }}
        />
      )}
      {activeTab === 'sil' && (
        <SILLedgerTab employees={state.employees} attendance={allRecords} todayStr={todayStr}/>
      )}
      {activeTab === 'tardiness' && (
        <TardinessTab records={tardinessRecords} empMap={empMap}
          onDelete={id => { dispatch({ type:'DELETE_ATTENDANCE', id }); toast(dispatch,'Record removed','warning'); }}/>
      )}
      {activeTab === 'holiday' && (
        <HolidayPayTab
          employees={state.employees}
          entries={state.holidayEntries || []}
          empMap={empMap}
          onAdd={entry => { dispatch({ type:'ADD_HOLIDAY_ENTRY', payload:entry }); toast(dispatch,'Holiday entry added'); }}
          onUpdate={entry => { dispatch({ type:'UPDATE_HOLIDAY_ENTRY', payload:entry }); toast(dispatch,'Holiday entry updated'); }}
          onDelete={id => { dispatch({ type:'DELETE_HOLIDAY_ENTRY', id }); toast(dispatch,'Holiday entry removed','warning'); }}
        />
      )}

      {/* Form modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Log Leave / Attendance" wide>
        <LeaveForm
          employees={state.employees}
          attendance={allRecords}
          onSave={rec => {
            dispatch({ type:'ADD_ATTENDANCE', payload:{ id:uid(), ...rec } });
            toast(dispatch, 'Record saved');
            setShowForm(false);
          }}
          onClose={() => setShowForm(false)}
        />
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PDF PAYROLL SUMMARY GENERATOR
// ─────────────────────────────────────────────────────────────
async function generatePayrollSummaryPDF(run, empMap) {
  const { default: jsPDF }     = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = 297;
  const M     = 12; // margin
  const isCO1 = run.cutOff === 1;
  const orange = [194, 65, 12];

  // ── TOP HEADER BAR ──────────────────────────────────────────
  doc.setFillColor(...orange);
  doc.rect(0, 0, pageW, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Dragon AI Media Inc.', M, 10);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Payroll Management System', M, 17);

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  // Helper: strip non-latin chars for jsPDF Helvetica compatibility
  // (en-dash, peso sign, curly quotes, etc. all corrupt Helvetica output)
  const safe = (s) => String(s || '').replace(/[^\x00-\x7E]/g, '-').replace(/-{2,}/g, '-').trim() || '-';

  doc.text('PAYROLL SUMMARY', pageW - M, 11, { align: 'right' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Cut-Off Period: ${safe(run.period)}`, pageW - M, 18, { align: 'right' });

  // ── SUB-HEADER (period info) ─────────────────────────────────
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(8.5);
  let infoY = 30;
  const pairs = [
    ['Coverage:',     safe(run.coverage || '-')],
    ['Release Date:', safe(run.releaseDateLabel || fmtDate(run.date))],
    ['Status:',       safe(run.status || 'Paid')],
    ['Employees:',    `${run.payslips.length}`],
    ['Currency:',     'Philippine Peso (PHP)'],
  ];
  pairs.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, M, infoY);
    doc.setFont('helvetica', 'normal');
    doc.text(value, M + 28, infoY);
    infoY += 5;
  });

  // Use numeric date format to avoid locale-specific month names that may contain non-ASCII chars
  const now = new Date();
  const genDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${genDate}`, pageW - M, 30, { align: 'right' });

  // ── NUMBER FORMATTERS ───────────────────────────────────────
  // Always 2 decimal places, thousands separator, no peso sign (not in Helvetica charset)
  const p = (n) => {
    const num = Number(n) || 0;
    return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  // Total row: prefix with "PHP" (peso sign unsupported in jsPDF Helvetica)
  // Force explicit newline so ALL total cells are 2-line ("PHP" / amount).
  // Without this, short values like "PHP 29,887.50" fit on one line and
  // get centred vertically (valign:middle), making "PHP" appear lower
  // than cells where the longer value naturally wraps.
  const pT = (n) => `PHP\n${p(n)}`;
  const DASH = '-'; // plain hyphen — em/en dashes corrupt Helvetica output

  // ── TABLE ───────────────────────────────────────────────────
  const head = [[
    '#', 'Employee Name', 'Department', 'Daily Rate', 'Days',
    'Gross Pay', 'SSS', 'PhilHealth', 'Pag-IBIG',
    'Loans', 'Total Deductions', 'Net Pay',
  ]];

  const body = run.payslips.map((ps, i) => {
    const emp   = empMap[ps.employeeId];
    const dr    = ps.dailyRate || (emp?.salary || 0) / 26;
    const loans = (ps.sssLoan || 0) + (ps.hdmfLoan || 0) + (ps.companyLoan || 0)
                + (typeof ps.otherLoans === 'number' ? ps.otherLoans : 0);
    return [
      i + 1,
      safe(emp?.name || ps.employeeId),
      safe(emp?.dept || DASH),
      p(dr),                                          // Daily Rate — always 2dp
      String(ps.workingDays ?? DASH),                 // Days — center-aligned
      p(ps.grossPay),                                 // Gross Pay
      isCO1 ? DASH : p(ps.sss || 0),                 // SSS
      isCO1 ? DASH : p(ps.philHealth || 0),           // PhilHealth
      isCO1 ? DASH : p(ps.pagIbig || 0),              // Pag-IBIG
      p(loans),                                       // Loans — 0.00 when none
      isCO1 ? DASH : p(ps.totalDeductions || 0),      // Total Deductions
      p(ps.netPay),                                   // Net Pay (bolded via didParseCell)
    ];
  });

  // ── TOTALS ROW ───────────────────────────────────────────────
  const tGross  = run.payslips.reduce((s,q) => s + q.grossPay, 0);
  const tSSS    = run.payslips.reduce((s,q) => s + (q.sss || 0), 0);
  const tPH     = run.payslips.reduce((s,q) => s + (q.philHealth || 0), 0);
  const tHDMF   = run.payslips.reduce((s,q) => s + (q.pagIbig || 0), 0);
  const tLoans  = run.payslips.reduce((s,q) =>
    s + (q.sssLoan||0) + (q.hdmfLoan||0) + (q.companyLoan||0)
      + (typeof q.otherLoans==='number' ? q.otherLoans : 0), 0);
  const tDeduct = run.payslips.reduce((s,q) => s + (q.totalDeductions || 0), 0);
  const tNet    = run.payslips.reduce((s,q) => s + q.netPay, 0);

  // ── FOOT (total row) — jsPDF autotable footer, always perfectly column-aligned ──
  // "PHP X,XXX.XX" prefix only on this row (accounting convention)
  const foot = [[
    '', 'TOTAL', `${run.payslips.length} employees`, '', '',
    pT(tGross),
    isCO1 ? DASH : pT(tSSS),
    isCO1 ? DASH : pT(tPH),
    isCO1 ? DASH : pT(tHDMF),
    pT(tLoans),
    isCO1 ? DASH : pT(tDeduct),
    pT(tNet),
  ]];

  // Column widths MUST sum to exactly (pageW - 2*M) = 273mm
  // to prevent jsPDF from auto-distributing leftover space and
  // causing head / body / foot cells to render at different x-offsets.
  // 10+60+26+21+11+23+19+20+18+18+24+23 = 273 ✓
  const colWidths = [10, 60, 26, 21, 11, 23, 19, 20, 18, 18, 24, 23];

  autoTable(doc, {
    head,
    body,
    foot,
    startY: 57,
    margin: { left: M, right: M },
    showFoot: 'lastPage',        // total row shows only once, at end of table

    styles: {
      fontSize:    7.5,
      cellPadding: { top: 3, bottom: 3, left: 2.5, right: 2.5 },
      valign:      'middle',
      overflow:    'linebreak',
      textColor:   [40, 40, 40],
    },

    headStyles: {
      fillColor:    orange,
      textColor:    [255, 255, 255],
      fontStyle:    'bold',
      halign:       'center',
      valign:       'middle',       // vertically center the header text
      fontSize:     7.5,
      cellPadding:  { top: 5, bottom: 5, left: 2.5, right: 2.5 },
      minCellHeight: 12,
    },

    footStyles: {
      fillColor:  [254, 232, 210],
      textColor:  [120, 30, 0],
      fontStyle:  'bold',
      fontSize:   8,
      valign:     'middle',
      cellPadding: { top: 4, bottom: 4, left: 2.5, right: 2.5 },
    },

    // ── Column widths & alignment (summing to exactly 273mm) ──
    columnStyles: {
      0:  { halign: 'center', cellWidth: colWidths[0]  },   // #
      1:  { halign: 'left',   cellWidth: colWidths[1]  },   // Employee Name
      2:  { halign: 'left',   cellWidth: colWidths[2]  },   // Department
      3:  { halign: 'right',  cellWidth: colWidths[3]  },   // Daily Rate
      4:  { halign: 'center', cellWidth: colWidths[4]  },   // Days
      5:  { halign: 'right',  cellWidth: colWidths[5]  },   // Gross Pay
      6:  { halign: 'right',  cellWidth: colWidths[6]  },   // SSS
      7:  { halign: 'right',  cellWidth: colWidths[7]  },   // PhilHealth
      8:  { halign: 'right',  cellWidth: colWidths[8]  },   // Pag-IBIG
      9:  { halign: 'right',  cellWidth: colWidths[9]  },   // Loans
      10: { halign: 'right',  cellWidth: colWidths[10] },   // Total Deductions
      11: { halign: 'right',  cellWidth: colWidths[11] },   // Net Pay
    },

    didParseCell: (data) => {
      const col = data.column.index;
      const sec = data.section;
      const RED   = [180, 20,  20];   // bold red  — Total Deductions
      const GREEN = [20,  110, 20];   // bold green — Net Pay

      if (sec === 'body') {
        if (col === 10) {
          // Total Deductions — bold red in every data row
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = RED;
        } else if (col === 11) {
          // Net Pay — bold green in every data row
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = GREEN;
        }
      } else if (sec === 'foot') {
        if (col === 10) {
          // PHP total for Total Deductions — bold red (overrides footStyles textColor)
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = RED;
        } else if (col === 11) {
          // PHP total for Net Pay — bold green (overrides footStyles textColor)
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = GREEN;
        }
      }
    },

    alternateRowStyles: { fillColor: [245, 240, 235] },
    rowPageBreak:  'avoid',
    tableLineColor: [210, 200, 190],
    tableLineWidth: 0.15,
  });

  // ── FOOTER ───────────────────────────────────────────────────
  const pageH = 210;
  const tblEnd = (doc.lastAutoTable?.finalY || 170) + 8;
  const sigY   = Math.min(tblEnd, pageH - 28);

  if (isCO1) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150, 150, 150);
    doc.text(
      '* Government contributions (SSS, PhilHealth, Pag-IBIG) are withheld on Cut-Off 2 only.',
      M, sigY - 4
    );
  }

  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.3);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);

  // Left sig
  doc.line(M, sigY, M + 65, sigY);
  doc.text('Prepared by', M, sigY + 4.5);
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text('(Signature over Printed Name)', M, sigY + 8.5);

  // Right sig
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.line(pageW - M - 65, sigY, pageW - M, sigY);
  doc.text('Approved by', pageW - M - 65, sigY + 4.5);
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  doc.text('(Signature over Printed Name)', pageW - M - 65, sigY + 8.5);

  // Bottom bar
  doc.setFillColor(...orange);
  doc.rect(0, pageH - 6, pageW, 6, 'F');
  doc.setFontSize(6.5);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'System-generated payroll summary  |  Dragon AI Media Inc.  |  Confidential',
    pageW / 2, pageH - 2.5, { align: 'center' }
  );

  // Strip non-ASCII from filename too (en-dash in period label)
  doc.save(`Payroll_Summary_${run.period.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`);
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
  const [pdfLoadingId, setPdfLoadingId] = useState(null);

  const empMap = useMemo(() => Object.fromEntries(state.employees.map(e=>[e.id,e])), [state.employees]);

  const handleDownloadSummary = async (e, run) => {
    e.stopPropagation();
    setPdfLoadingId(run.id);
    try {
      await generatePayrollSummaryPDF(run, empMap);
    } catch (err) {
      console.error('PDF generation failed:', err);
    }
    setPdfLoadingId(null);
  };

  const filteredRuns = useMemo(() =>
    state.payrollRuns
      .filter(r => !runFilter || runFilter==='all' || r.id===runFilter)
      .sort((a, b) => b.date.localeCompare(a.date))
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
                  {/* Download PDF Summary bar */}
                  <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs text-gray-500 font-medium">
                      {filteredPayslips.length} of {run.payslips.length} employees shown
                    </p>
                    <button
                      onClick={e => handleDownloadSummary(e, run)}
                      disabled={pdfLoadingId === run.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 disabled:opacity-60 transition-colors">
                      {pdfLoadingId === run.id
                        ? <><RefreshCw size={12} className="animate-spin"/> Generating PDF…</>
                        : <><Download size={12}/> Download PDF Summary</>}
                    </button>
                  </div>
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
                              <button onClick={()=>setViewPayslip({payslip:ps,emp,period:run.period,releaseDateLabel:run.releaseDateLabel,coverage:run.coverage,startDate:run.startDate,endDate:run.date,runId:run.id})}
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
            cutOffStartDate={viewPayslip.startDate}
            otEntries={state.otEntries.filter(e =>
              e.includedInPayrollId === viewPayslip.runId &&
              e.employeeId === viewPayslip.emp?.id
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
    if (emp && emp.salary > 0) f('dailyRate', (emp.salary / 26).toFixed(2));
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
          <label className={labelCls}>Daily Rate (PHP) — auto-filled from employee salary ÷ 26</label>
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
  const dailyRate = emp ? emp.salary / 26 : 0;

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
      id:         uid(),
      employeeId: empId,
      date:       row.date,
      otType:     row.otType,
      timeIn:     row.timeIn,
      timeOut:    row.timeOut,
      dailyRate:  String(dailyRate.toFixed(2)),
      hours:      computed[i].hours,
      pay:        computed[i].pay,
      hasND:      computed[i].hours.ndHours > 0,
      status:     'Pending',  // Requires HR approval before payroll inclusion
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
          <span className="text-orange-600">₱{emp.salary.toLocaleString()} salary ÷ 26 working days</span>
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

  // Compute next cut-off start date (for "Assign to Next Cut-off" button)
  const nextCO = useMemo(() => {
    if (selCutOff === 1) {
      // next is cutOff2 of same month
      return schedule.cutOff2;
    } else {
      // next is cutOff1 of next month
      const nm = selMonth === 12 ? 1 : selMonth + 1;
      const ny = selMonth === 12 ? selYear + 1 : selYear;
      return getCutOffSchedule(ny, nm).cutOff1;
    }
  }, [selCutOff, selMonth, selYear, schedule]);

  // All entries in cut-off window OR carry-forwarded to this cut-off
  const coEntries = useMemo(() =>
    state.otEntries.filter(e =>
      (e.date >= activeCO.startDate && e.date <= activeCO.endDate) ||
      e.assignedCutOffStart === activeCO.startDate
    ),
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
        pending: acc.pending + ((!e.status || e.status === 'Pending') ? 1 : 0),
      }), { otHours:0, ndHours:0, otPay:0, ndPay:0, total:0, count:0, pending:0 });
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
        <div className="flex items-center gap-2">
          {/* Pending count pill */}
          {coEntries.filter(e => !e.status || e.status === 'Pending').length > 0 && (
            <button
              onClick={() => {
                const pendingIds = coEntries
                  .filter(e => (!e.status || e.status === 'Pending') && !e.includedInPayrollId)
                  .map(e => e.id);
                pendingIds.forEach(id => dispatch({ type:'UPDATE_OT_STATUS', id, status:'Approved' }));
                toast(dispatch, `${pendingIds.length} OT ${pendingIds.length === 1 ? 'entry' : 'entries'} approved`);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-xl text-xs font-semibold hover:bg-yellow-200 border border-yellow-200">
              <AlertCircle size={13}/>
              {coEntries.filter(e => !e.status || e.status === 'Pending').length} Pending — Approve All
            </button>
          )}
          <button onClick={() => setBatchEmpId('')}
            className="flex items-center gap-2 px-4 py-2 bg-orange-700 text-white rounded-xl text-sm font-medium hover:bg-orange-800 shadow-sm">
            <Plus size={16}/> Add OT Entry
          </button>
        </div>
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
                      {totals.pending > 0 && <>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">{totals.pending} pending</span>
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
                            {['Date','Day / Holiday','OT Type','Time In','Time Out','OT Hrs','🌙 ND','OT Pay','ND Pay','Total','Status',''].map(h=>(
                              <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {entries.map(entry => {
                            const otType      = OT_TYPES.find(t => t.id === entry.otType);
                            const holiday     = PH_HOLIDAYS[entry.date];
                            const dayInfo     = entry.hours?.dayInfo || getDaySchedule(entry.date);
                            const entryStatus = entry.status || 'Pending';
                            const isApproved  = entryStatus === 'Approved';
                            const isIncluded  = !!entry.includedInPayrollId;
                            // Entry is from a previous cut-off but assigned/carried forward to this one
                            const isCarryFwd  = entry.assignedCutOffStart === activeCO.startDate && entry.date < activeCO.startDate;
                            return (
                              <tr key={entry.id} className={`hover:bg-gray-50/50 transition-colors ${isIncluded ? 'opacity-60' : ''}`}>
                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-medium">
                                  <div className="flex flex-col gap-0.5">
                                    {fmtDate(entry.date)}
                                    {isCarryFwd && (
                                      <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap">
                                        ↩ prev. cut-off
                                      </span>
                                    )}
                                  </div>
                                </td>
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

                                {/* Status column */}
                                <td className="px-4 py-3">
                                  <div className="flex flex-col gap-1">
                                    <Badge status={entryStatus}/>
                                    {isIncluded && (
                                      <span className="text-[10px] text-gray-400 whitespace-nowrap">✓ In Payroll</span>
                                    )}
                                  </div>
                                </td>

                                {/* Actions */}
                                <td className="px-4 py-3">
                                  <div className="flex flex-col gap-1">
                                    {!isIncluded && (
                                      <div className="flex gap-1">
                                        {!isApproved && (
                                          <button
                                            onClick={() => dispatch({ type:'UPDATE_OT_STATUS', id:entry.id, status:'Approved' })}
                                            title="Approve"
                                            className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-medium">
                                            <Check size={11}/> Approve
                                          </button>
                                        )}
                                        {isApproved && (
                                          <button
                                            onClick={() => dispatch({ type:'UPDATE_OT_STATUS', id:entry.id, status:'Pending' })}
                                            title="Revoke Approval"
                                            className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-yellow-50 text-yellow-700 hover:bg-yellow-100 text-xs font-medium">
                                            <X size={11}/> Revoke
                                          </button>
                                        )}
                                        {isApproved && (
                                          <button
                                            onClick={() => {
                                              dispatch({ type:'UPDATE_OT_STATUS', id:entry.id, status:'Approved', assignedCutOffStart: nextCO.startDate });
                                              toast(dispatch, `OT entry assigned to ${nextCO.label}`);
                                            }}
                                            title={`Assign to ${nextCO.label}`}
                                            className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-medium whitespace-nowrap">
                                            ↪ Next Cut-off
                                          </button>
                                        )}
                                        <button onClick={()=>setEditing(entry)} className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-400 hover:text-orange-700"><Edit2 size={13}/></button>
                                        <button onClick={()=>setDelConfirm(entry)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500"><Trash2 size={13}/></button>
                                      </div>
                                    )}
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
                            <td></td><td></td>
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

      {/* ── Carry Forward Panel ── */}
      {/* Shows ALL approved, unincluded OT from any past cut-off, so HR can pull them into the current period */}
      {(() => {
        const pastUnpaid = state.otEntries.filter(e =>
          e.status === 'Approved' &&
          !e.includedInPayrollId &&
          e.date < activeCO.startDate &&
          e.assignedCutOffStart !== activeCO.startDate   // not already assigned here
        );
        if (!pastUnpaid.length) return null;
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-amber-200 bg-amber-100/60">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertCircle size={15}/>
                <span className="font-semibold text-sm">
                  Carry Forward — {pastUnpaid.length} approved OT {pastUnpaid.length === 1 ? 'entry' : 'entries'} from past cut-offs
                </span>
              </div>
              <button
                onClick={() => {
                  pastUnpaid.forEach(e =>
                    dispatch({ type:'UPDATE_OT_STATUS', id:e.id, status:'Approved', assignedCutOffStart: activeCO.startDate })
                  );
                  toast(dispatch, `${pastUnpaid.length} OT ${pastUnpaid.length === 1 ? 'entry' : 'entries'} assigned to ${activeCO.label}`);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-700 text-white rounded-lg text-xs font-semibold hover:bg-amber-800">
                ↩ Assign All to {activeCO.label}
              </button>
            </div>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-amber-50 text-xs text-amber-700 uppercase tracking-wide">
                    {['Employee','Original Date','OT Type','OT Hrs','Total Pay',''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {pastUnpaid.map(entry => {
                    const emp     = empMap[entry.employeeId];
                    const otType  = OT_TYPES.find(t => t.id === entry.otType);
                    return (
                      <tr key={entry.id} className="hover:bg-amber-50/70">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                              style={{ background: DEPT_COLORS[emp?.dept] || '#c2410c' }}>
                              {emp?.name?.charAt(0) || '?'}
                            </div>
                            {emp?.name || entry.employeeId}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(entry.date)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${otType?.color || 'bg-gray-100 text-gray-600'}`}>
                            {otType?.label || entry.otType}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-orange-700">{entry.hours?.otHours?.toFixed(2) || '—'}</td>
                        <td className="px-4 py-3 font-bold text-orange-700">+{fmt(entry.pay?.total || 0)}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              dispatch({ type:'UPDATE_OT_STATUS', id:entry.id, status:'Approved', assignedCutOffStart: activeCO.startDate });
                              toast(dispatch, `OT entry assigned to ${activeCO.label}`);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 whitespace-nowrap">
                            ↩ Assign to {activeCO.label}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

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
  { id:'attendance',  label:'Attendance & Leave',icon:Clock       },
  { id:'ot',          label:'OT Processing',     icon:Timer       },
  { id:'payroll',     label:'Run Payroll',       icon:DollarSign  },
  { id:'finalpay',    label:'Final Pay',         icon:Banknote    },
  { id:'history',     label:'Payroll History',   icon:History     },
  { id:'reports',     label:'Reports',           icon:BarChart2   },
];

// ─────────────────────────────────────────────────────────────
// SETTINGS PAGE
// ─────────────────────────────────────────────────────────────
function Settings() {
  const { state, dispatch } = useApp();
  const s = state.deductionSettings || DEFAULT_DEDUCTIONS;
  const [form, setForm] = useState({ ...s });
  const [saved, setSaved] = useState(false);

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); setSaved(false); }

  function handleSave(e) {
    e.preventDefault();
    const parsed = Object.fromEntries(Object.entries(form).map(([k,v]) => [k, parseFloat(v) || 0]));
    dispatch({ type: 'UPDATE_DEDUCTION_SETTINGS', payload: parsed });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleReset() {
    setForm({ ...DEFAULT_DEDUCTIONS });
    dispatch({ type: 'UPDATE_DEDUCTION_SETTINGS', payload: DEFAULT_DEDUCTIONS });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const Field = ({ label, value, onChange, suffix, hint }) => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</label>
      <div className="relative">
        <input
          type="number" step="0.01" min="0" value={value} onChange={e => onChange(e.target.value)}
          className="w-full px-4 py-2.5 pr-14 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">{suffix}</span>
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-800">Settings</h2>
        <p className="text-sm text-gray-400 mt-0.5">Manage mandatory government deduction rates and caps</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* SSS */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <ShieldCheck size={15} className="text-blue-600"/>
            </div>
            <h3 className="font-semibold text-gray-800">SSS</h3>
            <span className="text-xs text-gray-400">Social Security System</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Employee Rate" value={form.sssRate} onChange={v => set('sssRate', v)} suffix="%" hint="% of monthly salary"/>
            <Field label="Maximum Cap" value={form.sssCap} onChange={v => set('sssCap', v)} suffix="₱" hint="Max deduction per month"/>
          </div>
        </div>

        {/* PhilHealth */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <ShieldCheck size={15} className="text-green-600"/>
            </div>
            <h3 className="font-semibold text-gray-800">PhilHealth</h3>
            <span className="text-xs text-gray-400">Philippine Health Insurance</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Employee Rate" value={form.philHealthRate} onChange={v => set('philHealthRate', v)} suffix="%" hint="% of monthly salary"/>
            <Field label="Minimum" value={form.philHealthMin} onChange={v => set('philHealthMin', v)} suffix="₱" hint="Min deduction"/>
            <Field label="Maximum Cap" value={form.philHealthCap} onChange={v => set('philHealthCap', v)} suffix="₱" hint="Max deduction"/>
          </div>
        </div>

        {/* Pag-IBIG */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
              <ShieldCheck size={15} className="text-orange-600"/>
            </div>
            <h3 className="font-semibold text-gray-800">Pag-IBIG</h3>
            <span className="text-xs text-gray-400">Home Development Mutual Fund</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Employee Rate" value={form.pagIbigRate} onChange={v => set('pagIbigRate', v)} suffix="%" hint="% of monthly salary"/>
            <Field label="Maximum Cap" value={form.pagIbigCap} onChange={v => set('pagIbigCap', v)} suffix="₱" hint="Max deduction per month"/>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button type="submit"
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-700 hover:bg-orange-800 text-white rounded-xl text-sm font-semibold transition">
            <Check size={15}/> Save Changes
          </button>
          <button type="button" onClick={handleReset}
            className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
            Reset to Defaults
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <Check size={14}/> Saved!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

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
// LOGIN PAGE
// ─────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setTimeout(() => {
      const creds = JSON.parse(localStorage.getItem('payroll_credentials') || 'null')
        || { username: 'admin', password: 'admin123' };
      if (username === creds.username && password === creds.password) {
        onLogin();
      } else {
        setError('Invalid username or password.');
      }
      setLoading(false);
    }, 600);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50" style={{background:'linear-gradient(135deg,#1a0e00 0%,#3b1a00 60%,#c2410c 100%)'}}>
      <div className="w-full max-w-sm mx-4">
        {/* Logo card */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mb-4 shadow-xl">
            <img src="/dragonai-logo.png" alt="Dragon AI" className="w-14 h-14 object-contain"
              onError={e => { e.target.style.display='none'; }}/>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">DRAGON AI</h1>
          <p className="text-orange-300 text-sm font-medium mt-0.5">Payroll System</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-bold text-gray-800 mb-1">Sign in</h2>
          <p className="text-sm text-gray-400 mb-6">Enter your credentials to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Username"
                autoFocus
                required
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw ? <Unlock size={15}/> : <Lock size={15}/>}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                <AlertCircle size={14}/> {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-xl bg-orange-700 hover:bg-orange-800 text-white font-semibold text-sm transition disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
              {loading ? (
                <><RefreshCw size={14} className="animate-spin"/> Signing in…</>
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-white/30 text-xs mt-6">DRAGON AI © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CHANGE CREDENTIALS MODAL
// ─────────────────────────────────────────────────────────────
function ChangeCredentialsModal({ onClose }) {
  const creds = JSON.parse(localStorage.getItem('payroll_credentials') || 'null')
    || { username: 'admin', password: 'admin123' };

  const [currentPw,  setCurrentPw]  = useState('');
  const [newUser,    setNewUser]     = useState(creds.username);
  const [newPw,      setNewPw]       = useState('');
  const [confirmPw,  setConfirmPw]   = useState('');
  const [showCur,    setShowCur]     = useState(false);
  const [showNew,    setShowNew]     = useState(false);
  const [error,      setError]       = useState('');
  const [success,    setSuccess]     = useState('');

  function handleSave(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (currentPw !== creds.password) { setError('Current password is incorrect.'); return; }
    if (!newUser.trim())              { setError('Username cannot be empty.'); return; }
    if (newPw && newPw.length < 6)   { setError('New password must be at least 6 characters.'); return; }
    if (newPw && newPw !== confirmPw) { setError('New passwords do not match.'); return; }
    const updated = { username: newUser.trim(), password: newPw || creds.password };
    localStorage.setItem('payroll_credentials', JSON.stringify(updated));
    setSuccess('Credentials updated successfully!');
    setTimeout(onClose, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-orange-700"/>
            <h2 className="font-bold text-gray-800">Change Login Credentials</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16}/></button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Current Password</label>
            <div className="relative">
              <input type={showCur ? 'text' : 'password'} value={currentPw} onChange={e=>setCurrentPw(e.target.value)}
                required placeholder="Enter current password"
                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition"/>
              <button type="button" onClick={()=>setShowCur(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showCur ? <Unlock size={14}/> : <Lock size={14}/>}
              </button>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-200 pt-4">
            {/* New Username */}
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">New Username</label>
            <input type="text" value={newUser} onChange={e=>setNewUser(e.target.value)}
              required placeholder="New username"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition mb-4"/>

            {/* New Password */}
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">New Password <span className="text-gray-400 normal-case font-normal">(leave blank to keep current)</span></label>
            <div className="relative mb-4">
              <input type={showNew ? 'text' : 'password'} value={newPw} onChange={e=>setNewPw(e.target.value)}
                placeholder="New password (min. 6 chars)"
                className="w-full px-4 py-2.5 pr-10 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition"/>
              <button type="button" onClick={()=>setShowNew(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showNew ? <Unlock size={14}/> : <Lock size={14}/>}
              </button>
            </div>

            {/* Confirm Password */}
            {newPw && (
              <>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Confirm New Password</label>
                <input type="password" value={confirmPw} onChange={e=>setConfirmPw(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition"/>
              </>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              <AlertCircle size={14}/> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
              <Check size={14}/> {success}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition">
              Cancel
            </button>
            <button type="submit"
              className="flex-1 py-2.5 rounded-xl bg-orange-700 text-white text-sm font-semibold hover:bg-orange-800 transition">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// USER MENU DROPDOWN
// ─────────────────────────────────────────────────────────────
function UserMenu({ onChangeCreds, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
        <div className="w-8 h-8 bg-orange-700 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">A</div>
        <div className="hidden sm:block text-left">
          <p className="font-semibold text-gray-800 text-sm leading-tight">HR Admin</p>
          <p className="text-xs text-gray-400">Payroll Manager</p>
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}/>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
          <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-orange-700 rounded-full flex items-center justify-center text-white text-sm font-bold">A</div>
              <div>
                <p className="font-semibold text-gray-800 text-sm">HR Admin</p>
                <p className="text-xs text-gray-400">Payroll Manager</p>
              </div>
            </div>
          </div>
          <div className="py-1.5">
            <button
              onClick={() => { setOpen(false); onChangeCreds(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <ShieldCheck size={15} className="text-orange-600"/>
              Change Password
            </button>
            <div className="my-1 border-t border-gray-100"/>
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
              <Lock size={15}/>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function PayrollApp() {
  const [isLoggedIn,     setIsLoggedIn]     = useState(() => sessionStorage.getItem('payroll_auth') === '1');
  const [showChangeCreds, setShowChangeCreds] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);
  const [state, dispatch] = useReducer(reducer, initialState);
  const [activePage, setActivePage] = useState(() => sessionStorage.getItem('payroll_page') || 'dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saving' | 'saved' | 'error'
  const notifRef = useRef(null);
  const notifications = useNotifications(state);

  const LS_KEY = 'payroll_state_backup';

  // Load state: Supabase first, fall back to localStorage
  useEffect(() => {
    async function loadState() {
      try {
        const { data, error } = await supabase
          .from('payroll_state')
          .select('data')
          .eq('id', 'main')
          .single();
        if (!error && data?.data) {
          dispatch({ type: 'LOAD_STATE', payload: data.data });
          setDbLoading(false);
          return;
        }
      } catch (e) {
        console.error('Supabase load failed:', e);
      }
      // Supabase failed or empty — try localStorage backup
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          dispatch({ type: 'LOAD_STATE', payload: parsed });
        }
      } catch (e) {
        console.error('localStorage load failed:', e);
      }
      setDbLoading(false);
    }
    loadState();
  }, []);

  // Save state to Supabase + localStorage
  const saveTimer  = useRef(null);
  const stateRef   = useRef(state);
  const loadedRef  = useRef(false);
  stateRef.current = state;

  const saveNow = useCallback(async (s) => {
    const { toasts, ...persist } = s || stateRef.current;
    // Always save to localStorage immediately (fast, reliable)
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(persist));
    } catch (e) {
      console.error('localStorage save failed:', e);
    }
    // Also save to Supabase for cross-browser sync
    setSaveStatus('saving');
    try {
      const { error } = await supabase.from('payroll_state').upsert({
        id: 'main',
        data: persist,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      setSaveStatus('saved');
    } catch (e) {
      console.error('Supabase save failed:', e);
      setSaveStatus('error');
    }
  }, []);

  // Debounced auto-save (600ms) after every state change
  useEffect(() => {
    if (dbLoading) return;
    if (!loadedRef.current) { loadedRef.current = true; return; } // skip first render after load
    setSaveStatus('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNow(state), 600);
  }, [state, dbLoading, saveNow]);

  // Save immediately when user refreshes or closes the tab
  useEffect(() => {
    const handleUnload = () => {
      const { toasts, ...persist } = stateRef.current;
      try { localStorage.setItem(LS_KEY, JSON.stringify(persist)); } catch(e) {}
      saveNow(stateRef.current);
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') handleUnload();
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [saveNow]);

  // Close notification panel when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [notifOpen]);

  const PAGE_MAP = {
    dashboard:  <Dashboard/>,
    employees:  <EmployeeManagement/>,
    payroll:    <PayrollProcessing/>,
    attendance: <AttendanceLeave/>,
    ot:         <OTProcessing/>,
    history:    <PayrollHistory/>,
    finalpay:   <FinalPayPage/>,
    reports:    <Reports/>,
  };

  const currentNav = NAV_ITEMS.find(n=>n.id===activePage);

  function handleNavigate(page) {
    sessionStorage.setItem('payroll_page', page);
    setActivePage(page);
  }

  function handleLogin() {
    sessionStorage.setItem('payroll_auth', '1');
    setIsLoggedIn(true);
  }

  function handleLogout() {
    sessionStorage.removeItem('payroll_auth');
    setIsLoggedIn(false);
  }

  if (!isLoggedIn) return <LoginPage onLogin={handleLogin}/>;

  if (dbLoading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{background:'linear-gradient(135deg,#1a0e00 0%,#3b1a00 60%,#c2410c 100%)'}}>
      <img src="/dragonai-logo.png" alt="Dragon AI" className="w-16 h-16 object-contain animate-pulse"/>
      <p className="text-white font-semibold text-lg tracking-wide">Loading Payroll Data…</p>
      <p className="text-orange-300 text-sm">Connecting to database</p>
    </div>
  );

  return (
    <AppCtx.Provider value={{ state, dispatch }}>
      {showChangeCreds && <ChangeCredentialsModal onClose={() => setShowChangeCreds(false)}/>}
      <div className="flex h-screen bg-gray-50 font-sans overflow-hidden">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex">
          <Sidebar active={activePage} setActive={handleNavigate} collapsed={collapsed} setCollapsed={setCollapsed}/>
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
                    <button key={item.id} onClick={()=>{handleNavigate(item.id);setMobileMenuOpen(false);}}
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
              {/* Save Status Indicator */}
              <div className="flex items-center gap-1.5 text-xs font-medium select-none">
                {saveStatus === 'saving' && (
                  <><span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse inline-block"/><span className="text-yellow-600 hidden sm:inline">Saving…</span></>
                )}
                {saveStatus === 'saved' && (
                  <><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/><span className="text-green-600 hidden sm:inline">Saved</span></>
                )}
                {saveStatus === 'error' && (
                  <><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block"/><span className="text-red-600 hidden sm:inline" title="Data saved locally. Cloud sync failed.">Local only</span></>
                )}
              </div>
              {/* Notification Bell */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen(o => !o)}
                  className="relative p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Notifications"
                >
                  <Bell size={18} className={notifications.length > 0 ? 'text-orange-500' : 'text-gray-400'}/>
                  {notifications.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                      {notifications.length > 9 ? '9+' : notifications.length}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <NotificationPanel
                    notifications={notifications}
                    onNavigate={handleNavigate}
                    onClose={() => setNotifOpen(false)}
                  />
                )}
              </div>
              {/* User Menu */}
              <UserMenu onChangeCreds={() => setShowChangeCreds(true)} onLogout={handleLogout}/>
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
