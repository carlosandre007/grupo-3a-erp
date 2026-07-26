import React, { useState, useMemo, useEffect } from 'react';
import { 
  Bike, 
  MapPin, 
  Plus, 
  Search, 
  SlidersHorizontal,
  Trash2,
  CheckCircle,
  Clock,
  ShieldAlert,
  Download, Pencil,
  Fuel,
  FileText
} from 'lucide-react';
import { getVehicles, addVehicle, saveVehicles, updateVehicle, addDeletionLog } from '../mockData';
import { Vehicle } from '../types';
import LoadingOverlay from '../components/LoadingOverlay';
import Modal from '../components/Modal';
import DeleteConfirmation from '../components/DeleteConfirmation';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { repository } from '../repositories';
import type { EntityRecord } from '../repositories';
import { assetImage, useAssetFallback } from '../lib/assetImages';
import AssetPhotoField from '../components/AssetPhotoField';

export default function Veiculos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => repository.kind==='supabase'?[]:getVehicles());
  const [visualState, setVisualState] = useState<'idle' | 'loading' | 'empty' | 'success'>('idle');

  // Filter and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');

  // Modal control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  React.useEffect(()=>{if(searchParams.get('new')==='1'){setEditingId(null);setIsModalOpen(true)}},[searchParams]);
  useEffect(()=>{if(repository.kind!=='supabase')return;Promise.all([repository.list<EntityRecord&{asset_type?:string;code?:string;name?:string;status?:string;acquisition_date?:string;purchase_value?:number;current_value?:number}>('assets'),repository.list<EntityRecord&{plate?:string;model?:string;rental_value?:number;ipva_due_date?:string;licensing_due_date?:string;next_maintenance?:string}>('vehicles')]).then(([assets,rows])=>{const byId=new Map(assets.map(item=>[item.id,item]));setVehicles(rows.map(row=>{const asset=byId.get(row.id);return{id:row.id,model:row.model||asset?.name||'',plate:row.plate||'',status:(asset?.status||'disponivel')as Vehicle['status'],image:'',code:asset?.code,kind:(asset?.asset_type==='carro'?'carro':'moto'),rentalValue:Number(row.rental_value||0),acquisitionDate:asset?.acquisition_date,purchaseValue:Number(asset?.purchase_value||0),currentValue:Number(asset?.current_value||0),ipvaDueDate:row.ipva_due_date,licensingDueDate:row.licensing_due_date,nextMaintenance:row.next_maintenance};}));}).catch(()=>setVehicles([]));},[]);

  // Form states
  const [formData, setFormData] = useState({
    model: '',
    plate: '',
    rentalValue: '',
    status: 'disponivel' as Vehicle['status'],
    tenant: '',
    image: '', kind: 'moto' as Vehicle['kind'], acquisitionDate: '', purchaseValue: '', currentValue: '', ipvaDueDate: '', licensingDueDate: ''
  });

  // Calculate live statistics
  const metrics = useMemo(() => {
    const total = vehicles.length;
    const locadas = vehicles.filter(v => v.status === 'locado').length;
    const manutencao = vehicles.filter(v => v.status === 'manutencao').length;
    const disponiveis = vehicles.filter(v => v.status === 'disponivel').length;
    const totalRevenue = vehicles.reduce((acc, curr) => acc + (curr.rentalValue || 0), 0);

    return {
      total,
      locadas,
      manutencao,
      disponiveis,
      totalRevenue
    };
  }, [vehicles]);

  // Handle Delete Vehicle
  const openEdit = (vehicle: Vehicle) => { setEditingId(vehicle.id); setFormData({ model: vehicle.model, plate: vehicle.plate, rentalValue: String(vehicle.rentalValue || ''), status: vehicle.status, tenant: vehicle.tenant || '', image: vehicle.image || '', kind: vehicle.kind || 'moto', acquisitionDate: vehicle.acquisitionDate || '', purchaseValue: String(vehicle.purchaseValue || ''), currentValue: String(vehicle.currentValue || ''), ipvaDueDate: vehicle.ipvaDueDate || '', licensingDueDate: vehicle.licensingDueDate || '' }); setIsModalOpen(true); };
  const handleDeleteVehicle = (id: string, reason: string) => {
    setVisualState('loading');
    setTimeout(() => {
      const remaining = vehicles.filter(v => v.id !== id);
      saveVehicles(remaining);
      const removed = vehicles.find(v => v.id === id); if (removed) addDeletionLog({ recordType: 'veiculo', originalId: removed.id, description: `${removed.model} - ${removed.plate}`, company: 'LOC MOTTUS', sourceModule: 'Veículos', responsibleUser: 'Administrador 3A', reason, adminValidated: true });
      setVehicles(remaining);
      setVisualState('idle');
    }, 400);
  };

  // Filter vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      // Search
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const modelMatch = v.model.toLowerCase().includes(query);
        const plateMatch = v.plate.toLowerCase().includes(query);
        const tenantMatch = v.tenant?.toLowerCase().includes(query);
        if (!modelMatch && !plateMatch && !tenantMatch) return false;
      }
      // Status
      if (filterStatus !== 'Todos') {
        const targetStatus = filterStatus.toLowerCase();
        if (v.status !== targetStatus) return false;
      }
      return true;
    });
  }, [vehicles, searchQuery, filterStatus]);

  // Create new vehicle
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.model || !formData.plate || !formData.rentalValue) return;

    setIsModalOpen(false);
    setVisualState('loading');

    setTimeout(() => {
      const imgFallback = formData.image;
      const rentPrice = parseFloat(formData.rentalValue);

      const payload = {
        model: formData.model,
        plate: formData.plate,
        rentalValue: rentPrice,
        status: formData.status,
        tenant: formData.tenant || undefined,
        image: imgFallback,
        kind: formData.kind,
        acquisitionDate: formData.acquisitionDate || undefined,
        purchaseValue: Number(formData.purchaseValue) || undefined,
        currentValue: Number(formData.currentValue) || undefined,
        ipvaDueDate: formData.ipvaDueDate || undefined,
        licensingDueDate: formData.licensingDueDate || undefined,
        nextMaintenance: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };
      if (editingId) updateVehicle({ ...vehicles.find(v => v.id === editingId)!, ...payload, id: editingId }); else addVehicle(payload);

      setVehicles(getVehicles());
      setVisualState('success');

      // Reset form
      setFormData({
        model: '',
        plate: '',
        rentalValue: '',
        status: 'disponivel',
        tenant: '',
        image: '', kind: 'moto', acquisitionDate: '', purchaseValue: '', currentValue: '', ipvaDueDate: '', licensingDueDate: ''
      });
      setEditingId(null);

      setTimeout(() => setVisualState('idle'), 1000);

    }, 700);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <h2 className="font-display font-black text-on-surface text-lg tracking-tight">LOC MOTTUS (FROTA)</h2>
          <p className="text-xs text-secondary mt-0.5 font-sans">Gestão de frota de motocicletas, locações e manutenções programadas.</p>
        </div>

        <button 
          onClick={() => { setEditingId(null); setIsModalOpen(true); }}
          className="px-4 py-2.5 bg-primary-container text-on-primary-container font-display font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-95 active:scale-95 transition-all shadow-sm rounded-lg self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          CADASTRAR MOTO
        </button>
      </div>

      {/* Fleet Stats bento style */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        
        {/* Total vehicles count */}
        <div className="bg-white p-5 rounded-xl border border-outline-variant custom-shadow flex flex-col justify-between h-28">
          <div className="flex justify-between items-center text-xs font-bold text-secondary uppercase tracking-wider">
            <span>Frota Total</span>
            <Bike className="w-5 h-5 text-primary" />
          </div>
          <p className="font-display font-black text-2xl text-on-surface">{metrics.total} motos</p>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Veículos cadastrados</span>
        </div>

        {/* Leased count */}
        <div className="bg-white p-5 rounded-xl border border-outline-variant custom-shadow flex flex-col justify-between h-28 border-l-4 border-l-green-600">
          <div className="flex justify-between items-center text-xs font-bold text-secondary uppercase tracking-wider">
            <span>Locadas</span>
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <p className="font-display font-black text-2xl text-green-700">{metrics.locadas} motos</p>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Uso comercial ativo</span>
        </div>

        {/* Available count */}
        <div className="bg-white p-5 rounded-xl border border-outline-variant custom-shadow flex flex-col justify-between h-28">
          <div className="flex justify-between items-center text-xs font-bold text-secondary uppercase tracking-wider">
            <span>Disponíveis</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <p className="font-display font-black text-2xl text-on-surface">{metrics.disponiveis} motos</p>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Prontas para aluguel</span>
        </div>

        {/* Maintenance count */}
        <div className="bg-white p-5 rounded-xl border border-outline-variant custom-shadow flex flex-col justify-between h-28">
          <div className="flex justify-between items-center text-xs font-bold text-secondary uppercase tracking-wider">
            <span>Em Manutenção</span>
            <ShieldAlert className="w-5 h-5 text-error animate-pulse" />
          </div>
          <p className="font-display font-black text-2xl text-red-600">{metrics.manutencao} motos</p>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Oficina / Revisão</span>
        </div>

        {/* Average rental revenue */}
        <div className="bg-white p-5 rounded-xl border border-outline-variant custom-shadow flex flex-col justify-between h-28">
          <div className="flex justify-between items-center text-xs font-bold text-secondary uppercase tracking-wider">
            <span>Faturamento Estimado</span>
            <span className="font-display font-black text-xs text-primary">R$</span>
          </div>
          <p className="font-display font-black text-lg text-primary">
            R$ {metrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Receita total mensal</span>
        </div>

      </div>

      {/* Filter and Search controls */}
      <div className="bg-white p-4 rounded-xl border border-outline-variant custom-shadow flex flex-wrap items-center gap-4">
        
        {/* Search */}
        <div className="relative flex-grow min-w-[240px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar moto por placa, modelo ou locatário..."
            className="w-full bg-gray-50 pl-10 pr-4 py-2 border border-outline-variant rounded text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-container"
          />
        </div>

        {/* Status Filter */}
        <select 
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-white border border-outline-variant rounded px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container cursor-pointer"
        >
          <option>Todos</option>
          <option value="Locado">Locado</option>
          <option value="Disponivel">Disponível</option>
          <option value="Manutencao">Manutenção</option>
        </select>

        <button 
          onClick={() => {
            setSearchQuery('');
            setFilterStatus('Todos');
          }}
          className="px-4 py-2 border border-black hover:bg-black hover:text-white rounded text-xs font-display font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 focus:outline-none"
        >
          <SlidersHorizontal className="w-4 h-4" />
          LIMPAR FILTROS
        </button>
      </div>

      {/* Main layout grid with interactive cards */}
      <LoadingOverlay 
        state={visualState === 'idle' && filteredVehicles.length === 0 ? 'empty' : visualState}
        emptyTitle="Nenhum veículo encontrado"
        emptyDesc="Não encontramos veículos cadastrados com os filtros selecionados."
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Vehicles cards list */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {filteredVehicles.map((v) => {
              return (
                <div key={v.id} role="button" tabIndex={0} onClick={() => navigate(`/bens/veiculo/${v.id}`)} onKeyDown={e => e.key === 'Enter' && navigate(`/bens/veiculo/${v.id}`)} className="bg-white border border-outline-variant rounded-xl overflow-hidden custom-shadow flex flex-col justify-between group hover:border-primary-container hover:-translate-y-0.5 cursor-pointer transition-all">
                  
                  {/* Motorcycle banner card */}
                  <div className="h-44 overflow-hidden relative bg-gray-100">
                    <img 
                      src={assetImage(v.image, v.kind)}
                      onError={event => useAssetFallback(event, v.kind)}
                      alt={`${v.kind === 'carro' ? 'Carro' : 'Moto'} ${v.code || ''} — ${v.model}`}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent"/>
                    <div className={`absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${
                      v.status === 'locado' ? 'bg-amber-100 text-amber-800' :
                      v.status === 'disponivel' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {v.status}
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-display font-black text-on-surface text-sm tracking-tight uppercase">{v.model} <span className="text-primary">{v.code}</span></h4>
                        <button 
                          onClick={(event) => { event.stopPropagation(); setDeleteTarget(v); }}
                          className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"
                          title="Remover veículo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button onClick={(event) => { event.stopPropagation(); openEdit(v); }} title="Editar veículo" className="p-1.5 text-secondary hover:text-primary"><Pencil className="w-4 h-4" /></button><button onClick={(event) => { event.stopPropagation(); navigate(`/bens/veiculo/${v.id}`); }} className="text-[9px] font-bold text-primary">Ver detalhes</button>
                      </div>

                      <div className="flex items-center gap-1.5 mb-4">
                        <span className="text-[10px] bg-gray-100 text-secondary border border-outline-variant/50 px-2 py-0.5 font-bold uppercase tracking-wider rounded-sm">
                          PLACA: {v.plate}
                        </span>
                        <span className="text-[10px] text-gray-400 font-bold">•</span>
                        <span className="text-[10px] text-secondary font-bold flex items-center gap-1">
                          <Fuel className="w-3.5 h-3.5" /> FLEX
                        </span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-outline-variant/30 flex justify-between items-end">
                      <div>
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Valor Locação</span>
                        <span className="font-display font-black text-sm text-primary">
                          R$ {(v.rentalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          <span className="text-[10px] text-secondary font-normal uppercase"> /mês</span>
                        </span>
                      </div>

                      {v.tenant ? (
                        <div className="text-right">
                          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Locatário</span>
                          <span className="text-xs font-bold text-on-surface truncate max-w-[120px] inline-block">{v.tenant}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-green-700 font-bold uppercase bg-green-50 px-2 py-1 border border-green-200">
                          Disponível
                        </span>
                      )}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

          {/* LOC MOTTUS Sidebar specifics */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* IPVA Licensing Quick Action */}
            <div className="bg-inverse-surface text-white rounded-xl p-5 shadow-lg flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-5 h-5 text-primary-container" />
                <span className="font-display font-bold text-xs uppercase tracking-wider">LICENCIAMENTO EXERCÍCIO</span>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed mb-6">
                Consulte os vencimentos cadastrados de IPVA e licenciamento na Central de Alertas. A emissão de guias dependerá de integração futura.
              </p>

              <button 
                onClick={() => navigate('/alertas?tipo=IPVA')}
                className="w-full py-3 bg-primary-fixed text-on-primary-fixed font-display font-bold text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 focus:outline-none"
              >
                VER ALERTAS DE IPVA
              </button>
            </div>

          </div>

        </div>
      </LoadingOverlay>

      {/* Create Motorcycle Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Veículo (LOC MOTTUS)" : "Adicionar Novo Veículo (LOC MOTTUS)"}>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold uppercase">Tipo</label><select disabled={!!editingId} value={formData.kind} onChange={e=>setFormData(p=>({...p,kind:e.target.value as Vehicle['kind']}))} className="w-full border rounded p-2 text-xs"><option value="moto">Moto</option><option value="carro">Carro</option></select></div><div><label className="text-[10px] font-bold uppercase">Código automático</label><input readOnly value={editingId ? vehicles.find(v=>v.id===editingId)?.code || '' : 'Gerado ao salvar'} className="w-full border rounded p-2 text-xs bg-gray-50"/></div></div>
          <div className="grid grid-cols-3 gap-3"><input aria-label="Data de aquisição" type="date" value={formData.acquisitionDate} onChange={e=>setFormData(p=>({...p,acquisitionDate:e.target.value}))} className="border rounded p-2 text-xs"/><input aria-label="Valor de compra" type="number" placeholder="Valor de compra" value={formData.purchaseValue} onChange={e=>setFormData(p=>({...p,purchaseValue:e.target.value}))} className="border rounded p-2 text-xs"/><input aria-label="Valor atual" type="number" placeholder="Valor atual" value={formData.currentValue} onChange={e=>setFormData(p=>({...p,currentValue:e.target.value}))} className="border rounded p-2 text-xs"/></div>
          <div className="grid grid-cols-2 gap-3"><label className="text-[10px] font-bold uppercase">Vencimento do IPVA<input type="date" value={formData.ipvaDueDate} onChange={e=>setFormData(p=>({...p,ipvaDueDate:e.target.value}))} className="mt-1 w-full border rounded p-2 text-xs"/></label><label className="text-[10px] font-bold uppercase">Vencimento do licenciamento<input type="date" value={formData.licensingDueDate} onChange={e=>setFormData(p=>({...p,licensingDueDate:e.target.value}))} className="mt-1 w-full border rounded p-2 text-xs"/></label></div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Modelo do Veículo</label>
            <input 
              type="text"
              required
              placeholder="Modelo do veículo"
              value={formData.model}
              onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
              className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Placa do Veículo</label>
              <input 
                type="text"
                required
                placeholder="Ex: ABC-1D23 ou XYZ-5678"
                value={formData.plate}
                onChange={(e) => setFormData(prev => ({ ...prev, plate: e.target.value.toUpperCase() }))}
                className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Valor da Locação (R$/mês)</label>
              <input 
                type="number"
                required
                placeholder="Ex: 450.00"
                value={formData.rentalValue}
                onChange={(e) => setFormData(prev => ({ ...prev, rentalValue: e.target.value }))}
                className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Status do Veículo</label>
              <select 
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Vehicle['status'] }))}
                className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container bg-white"
              >
                <option value="disponivel">Disponível</option>
                <option value="locado">Alugado (Locado)</option>
                <option value="manutencao">Em Oficina / Revisão</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Nome do Locatário (Opcional)</label>
              <input 
                type="text"
                placeholder="Nome do cliente"
                value={formData.tenant}
                onChange={(e) => setFormData(prev => ({ ...prev, tenant: e.target.value }))}
                className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>
          </div>

          <div className="flex flex-col"><label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Foto real (opcional)</label><AssetPhotoField value={formData.image} type={formData.kind} onChange={image=>setFormData(prev=>({...prev,image}))}/></div>

          <button 
            type="submit"
            className="w-full py-3 bg-primary-container text-on-primary-container font-display font-black text-xs uppercase tracking-widest rounded-lg hover:brightness-95 transition-all mt-4"
          >
            CONFIRMAR CADASTRO
          </button>
        </form>
      </Modal>
      <DeleteConfirmation isOpen={!!deleteTarget} recordName={deleteTarget ? `${deleteTarget.model} - ${deleteTarget.plate}` : ''} onClose={() => setDeleteTarget(null)} onValidated={reason => { if (deleteTarget) handleDeleteVehicle(deleteTarget.id, reason); setDeleteTarget(null); }} />

    </div>
  );
}
