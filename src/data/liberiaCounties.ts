// Liberia's 15 counties and their administrative districts, used to power
// the searchable County -> District cascading dropdowns throughout the
// online registration form. This is reference/lookup data only (no backend
// dependency), so the dropdowns work immediately without an API round trip.

export interface CountyOption {
    county: string;
    districts: string[];
}

export const LIBERIA_COUNTIES: CountyOption[] = [
    { county: 'Bomi', districts: ['Dewoin', 'Klay', 'Mecca', 'Senjeh'] },
    { county: 'Bong', districts: ['Boinsen', 'Fuamah', 'Jorquelleh', 'Kokoyah', 'Kpaai', 'Panta', 'Salala', 'Sanoyea', 'Suakoko', 'Tukpahblee', 'Yeallequelleh', 'Zota'] },
    { county: 'Gbarpolu', districts: ['Belleh', 'Bopolu', 'Bokomu', 'Gbarma', 'Kongba', 'Suehn'] },
    { county: 'Grand Bassa', districts: ['District #1', 'District #2', 'District #3', 'District #4', 'Owensgrove', 'St. John River'] },
    { county: 'Grand Cape Mount', districts: ['Garwula', 'Golakonneh', 'Porkpa', 'Tewor'] },
    { county: 'Grand Gedeh', districts: ['Gbeapo', 'Konobo', 'Tchien', 'Cavalla'] },
    { county: 'Grand Kru', districts: ['Barclayville', 'Buah', 'Gboloken', 'Jloh', 'Sasstown'] },
    { county: 'Lofa', districts: ['Foya', 'Kolahun', 'Quardu Gboni', 'Salayea', 'Vahun', 'Voinjama', 'Zorzor'] },
    { county: 'Margibi', districts: ['Gibi', 'Kaba', 'Mambah-Kaba', 'Firestone'] },
    { county: 'Maryland', districts: ['Barrobo', 'Gwelekpokun', 'Harper', 'Karluway', 'Pleebo/Sodoken'] },
    { county: 'Montserrado', districts: ['Careysburg', 'Commonwealth', 'Greater Monrovia', 'Todee'] },
    { county: 'Nimba', districts: ['Buu-Yao', 'Doe', 'Gbehlageh', 'Kparblee', 'Meinpea-Mahn', 'Sanniquellie-Mahn', 'Tappita', 'Twan River', 'Wee-Gbehy-Mahn', 'Yamein', 'Zoe-Geh'] },
    { county: 'River Cess', districts: ['Central River Cess', 'Timbo', 'Yarnee', 'Zota'] },
    { county: 'River Gee', districts: ['Fenweta', 'Gbeapo', 'Karforh', 'Nyanwan', 'Potupo', 'Webbo'] },
    { county: 'Sinoe', districts: ['Butaw', 'Chedepo', 'Dugbe River', 'Greenville', 'Jaedae', 'Juarzon', 'Sanquin'] },
];

export const COUNTY_NAMES = LIBERIA_COUNTIES.map((c) => c.county);

export function getDistrictsForCounty(county: string): string[] {
    return LIBERIA_COUNTIES.find((c) => c.county === county)?.districts || [];
}
