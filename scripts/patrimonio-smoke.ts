const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key), clear: () => memory.clear() } });
Object.defineProperty(globalThis, 'window', { value: { dispatchEvent: () => true } });
Object.defineProperty(globalThis, 'CustomEvent', { value: class { constructor(public type: string) {} } });

const data = await import('../src/mockData.ts');
const moto1 = data.addVehicle({ model: 'Teste moto', plate: '', status: 'disponivel', image: 'teste.png', kind: 'moto' });
const carro = data.addVehicle({ model: 'Teste carro', plate: '', status: 'disponivel', image: 'teste.png', kind: 'carro' });
const kitnet = data.addProperty({ name: 'Teste kitnet', type: 'Kitnet', address: '', rentValue: 0, area: 0, status: 'disponivel', image: 'teste.png' });
const loja = data.addProperty({ name: 'Teste loja', type: 'Loja', address: '', rentValue: 0, area: 0, status: 'disponivel', image: 'teste.png' });
const casa = data.addProperty({ name: 'Teste casa', type: 'Casa', address: '', rentValue: 0, area: 0, status: 'disponivel', image: 'teste.png' });
if ([moto1.code, carro.code, kitnet.code, loja.code, casa.code].join(',') !== '01M,01CAR,01KIT,01LOJ,01CAS') throw new Error('Falha nos códigos automáticos');
data.saveVehicles(data.getVehicles().filter(item => item.id !== moto1.id));
const moto2 = data.addVehicle({ model: 'Teste moto 2', plate: '', status: 'disponivel', image: 'teste.png', kind: 'moto' });
if (moto2.code !== '02M') throw new Error('Código excluído foi reutilizado');
data.saveAssetDetails({ assetId: moto2.id, category: 'Moto', improvements: 100, updatedAt: new Date().toISOString() });
if (data.getAssetDetails()[0]?.assetId !== moto2.id) throw new Error('Detalhes não preservaram o UUID');
console.log('patrimonio-smoke: aprovado');
