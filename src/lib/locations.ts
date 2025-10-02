export interface LocationInfo {
  name: string;
  logo: string;
}

export const LOCATION_DATA: Record<string, LocationInfo> = {
  'Padel Up - Century City': {
    name: 'Padel Up - Century City',
    logo: 'https://cdn.prod.website-files.com/6657bfd4bd5e6513709cecf5/66635e7f6ca978c79be4b35f_logo-notext.svg',
  },
  'Padel Up - Culver City': {
    name: 'Padel Up - Culver City',
    logo: 'https://cdn.prod.website-files.com/6657bfd4bd5e6513709cecf5/66635e7f6ca978c79be4b35f_logo-notext.svg',
  },
  'The Padel Courts - Hollywood': {
    name: 'The Padel Courts - Hollywood',
    logo: 'https://img1.wsimg.com/isteam/ip/37b16837-021b-439a-bf27-a443023d5071/TPC%20Logotype%20White-643073b.png/:/rs=w:370,h:208,cg:true,m/cr=w:370,h:208/qt=q:95',
  },
  'Pura Padel - Sherman Oaks': {
    name: 'Pura Padel - Sherman Oaks',
    logo: 'https://paybycourts3.s3.amazonaws.com/uploads/facility/logo/765/Pura_Padel_Colored_Logo__1_.png',
  },
};

export const LOCATIONS = Object.keys(LOCATION_DATA);

export type Location = keyof typeof LOCATION_DATA;
