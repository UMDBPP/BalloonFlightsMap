/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.39.0.
 * Original file: /npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.esm.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 * 
 * Modified to remove Chart.js and date-fns version locks
 */
import{_adapters as e}from"chart.js";import{toDate as r,parse as t,parseISO as n,isValid as a,format as s,addYears as u,addQuarters as c,addMonths as o,addWeeks as i,addDays as m,addHours as d,addMinutes as y,addSeconds as f,addMilliseconds as h,differenceInYears as l,differenceInQuarters as w,differenceInMonths as p,differenceInWeeks as M,differenceInDays as q,differenceInHours as k,differenceInMinutes as S,differenceInSeconds as g,differenceInMilliseconds as O,startOfYear as D,startOfQuarter as P,startOfMonth as _,startOfWeek as b,startOfDay as j,startOfHour as v,startOfMinute as T,startOfSecond as W,endOfYear as x,endOfQuarter as z,endOfMonth as A,endOfWeek as B,endOfDay as C,endOfHour as E,endOfMinute as F,endOfSecond as G}from"date-fns";
/*!
 * chartjs-adapter-date-fns v3.0.0
 * https://www.chartjs.org
 * (c) 2022 chartjs-adapter-date-fns Contributors
 * Released under the MIT license
 */const H={datetime:"MMM d, yyyy, h:mm:ss aaaa",millisecond:"h:mm:ss.SSS aaaa",second:"h:mm:ss aaaa",minute:"h:mm aaaa",hour:"ha",day:"MMM d",week:"PP",month:"MMM yyyy",quarter:"qqq - yyyy",year:"yyyy"};e._date.override({_id:"date-fns",formats:function(){return H},parse:function(e,s){if(null==e)return null;const u=typeof e;return"number"===u||e instanceof Date?e=r(e):"string"===u&&(e="string"==typeof s?t(e,s,new Date,this.options):n(e,this.options)),a(e)?e.getTime():null},format:function(e,r){return s(e,r,this.options)},add:function(e,r,t){switch(t){case"millisecond":return h(e,r);case"second":return f(e,r);case"minute":return y(e,r);case"hour":return d(e,r);case"day":return m(e,r);case"week":return i(e,r);case"month":return o(e,r);case"quarter":return c(e,r);case"year":return u(e,r);default:return e}},diff:function(e,r,t){switch(t){case"millisecond":return O(e,r);case"second":return g(e,r);case"minute":return S(e,r);case"hour":return k(e,r);case"day":return q(e,r);case"week":return M(e,r);case"month":return p(e,r);case"quarter":return w(e,r);case"year":return l(e,r);default:return 0}},startOf:function(e,r,t){switch(r){case"second":return W(e);case"minute":return T(e);case"hour":return v(e);case"day":return j(e);case"week":return b(e);case"isoWeek":return b(e,{weekStartsOn:+t});case"month":return _(e);case"quarter":return P(e);case"year":return D(e);default:return e}},endOf:function(e,r){switch(r){case"second":return G(e);case"minute":return F(e);case"hour":return E(e);case"day":return C(e);case"week":return B(e);case"month":return A(e);case"quarter":return z(e);case"year":return x(e);default:return e}}});
//# sourceMappingURL=/sm/d9ecdb6b1c33de6e6c854847a527d4eb7aa43992a5eb3a524e6df7e4c0302b55.map