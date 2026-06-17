export const AREAS = [
  { id: 'GH-01', name: 'Greenhouse North', type: 'Hydroponic', area: '450m²', status: 'Occupied', plants: 'Tomatoes' },
  { id: 'GH-02', name: 'Greenhouse South', type: 'Soil-based', area: '600m²', status: 'Available', plants: 'None' },
  { id: 'OA-03', name: 'Open Field A', type: 'Irrigated', area: '1200m²', status: 'Active', plants: 'Corn' },
];

export const PESTS = [
  { name: 'Red Spider Mite', type: 'Pest', risk: 'High', treatment: 'Abamectin Spray', affected: 'Tomatoes, Peppers' },
  { name: 'Powdery Mildew', type: 'Disease', risk: 'Medium', treatment: 'Sulfur Fungicide', affected: 'Cucumber, Squash' },
  { name: 'Aphids', type: 'Pest', risk: 'Medium', treatment: 'Neem Oil', affected: 'General' },
];

export const INVENTORY = [
  { item: 'NPK 15-15-15', category: 'Fertilizer', stock: '240kg', unit: 'Bag', supplier: 'AgroCorp' },
  { item: 'Fungicide-X', category: 'Chemical', stock: '45L', unit: 'Bottle', supplier: 'BioSafe' },
  { item: 'Hybrid Tomato Seeds', category: 'Seeds', stock: '12,000', unit: 'Pack', supplier: 'SeedMaster' },
];

export const SPECIES = [
  {
    id: 1,
    name: 'Solanum lycopersicum',
    variety: 'Heirloom Red / Indeterminate',
    cycle: '85-90 Days',
    temp: '22°C - 28°C',
    status: 'Active',
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=100&h=100&fit=crop'
  },
  {
    id: 2,
    name: 'Lactuca sativa',
    variety: 'Parris Island Cos',
    cycle: '65-70 Days',
    temp: '15°C - 21°C',
    status: 'Active',
    image: 'https://images.unsplash.com/photo-1622206141855-520e74f3883a?w=100&h=100&fit=crop'
  },
  {
    id: 3,
    name: 'Capsicum annuum',
    variety: 'California Wonder',
    cycle: '75-80 Days',
    temp: '20°C - 30°C',
    status: 'Seasonal',
    image: 'https://images.unsplash.com/photo-1594489428504-5c0c480a15fd?w=100&h=100&fit=crop'
  },
  {
    id: 4,
    name: 'Fragaria x ananassa',
    variety: 'Garden Strawberry / Everbearing',
    cycle: '120-140 Days',
    temp: '18°C - 24°C',
    status: 'Active',
    image: 'https://images.unsplash.com/photo-1464960710334-31f2f272df7f?w=100&h=100&fit=crop'
  },
  {
    id: 5,
    name: 'Cucumis sativus',
    variety: 'Marketmore 76',
    cycle: '55-65 Days',
    temp: '22°C - 30°C',
    status: 'Active',
    image: 'https://images.unsplash.com/photo-1449339043483-287d3d636573?w=100&h=100&fit=crop'
  },
  {
    id: 6,
    name: 'Spinacia oleracea',
    variety: 'Bloomsdale Long Standing',
    cycle: '40-45 Days',
    temp: '10°C - 18°C',
    status: 'Seasonal',
    image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=100&h=100&fit=crop'
  },
  {
    id: 7,
    name: 'Daucus carota',
    variety: 'Nantes Coreless',
    cycle: '65-75 Days',
    temp: '15°C - 21°C',
    status: 'Active',
    image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=100&h=100&fit=crop'
  },
  {
    id: 8,
    name: 'Solanum melongena',
    variety: 'Black Beauty Eggplant',
    cycle: '75-85 Days',
    temp: '24°C - 32°C',
    status: 'Active',
    image: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=100&h=100&fit=crop'
  },
  {
    id: 9,
    name: 'Brassica oleracea',
    variety: 'Waltham 29 Broccoli',
    cycle: '85-95 Days',
    temp: '15°C - 20°C',
    status: 'Active',
    image: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=100&h=100&fit=crop'
  },
  {
    id: 10,
    name: 'Allium cepa',
    variety: 'Walla Walla Yellow Onion',
    cycle: '100-110 Days',
    temp: '15°C - 25°C',
    status: 'Seasonal',
    image: 'https://images.unsplash.com/photo-1508747703725-7197771375a0?w=100&h=100&fit=crop'
  }
];
