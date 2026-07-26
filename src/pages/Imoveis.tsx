import React, { useState, useMemo, useEffect } from 'react';
import { 
  Building2, 
  MapPin, 
  BedDouble, 
  Bath, 
  Maximize2, 
  Plus, 
  Search, 
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Bolt,
  Send,
  MoreVertical,
  Trash2,
  CheckCircle,
  Home, Pencil
} from 'lucide-react';
import { getProperties, addProperty, saveProperties, updateProperty, addDeletionLog } from '../mockData';
import { Property } from '../types';
import LoadingOverlay from '../components/LoadingOverlay';
import Modal from '../components/Modal';
import DeleteConfirmation from '../components/DeleteConfirmation';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { repository } from '../repositories';
import type { EntityRecord } from '../repositories';
import { assetImage, useAssetFallback } from '../lib/assetImages';
import AssetPhotoField from '../components/AssetPhotoField';

export default function Imoveis() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [properties, setProperties] = useState<Property[]>(() => repository.kind==='supabase'?[]:getProperties());
  const [visualState, setVisualState] = useState<'idle' | 'loading' | 'empty' | 'success'>('idle');

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('Todos os Tipos');
  const [filterStatus, setFilterStatus] = useState('Status: Todos');

  // Modal control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Property | null>(null);
  React.useEffect(()=>{if(searchParams.get('new')==='1'){setEditingId(null);setIsModalOpen(true)}},[searchParams]);
  useEffect(()=>{if(repository.kind!=='supabase')return;Promise.all([repository.list<EntityRecord&{asset_type?:string;code?:string;name?:string;status?:string;acquisition_date?:string;purchase_value?:number;current_value?:number}>('assets'),repository.list<EntityRecord&{address?:string;area?:number;bedrooms?:number;bathrooms?:number;rent_value?:number;rent_date?:string;annual_adjustment_date?:string;contract_end_date?:string}>('properties')]).then(([assets,rows])=>{const byId=new Map(assets.map(item=>[item.id,item]));setProperties(rows.map(row=>{const asset=byId.get(row.id),type=asset?.asset_type==='kitnet'?'Kitnet':asset?.asset_type==='loja'?'Loja':asset?.asset_type==='casa'?'Casa':'Outro';return{id:row.id,name:asset?.name||'',type,address:row.address||'',rentValue:Number(row.rent_value||0),area:Number(row.area||0),bedrooms:row.bedrooms,bathrooms:row.bathrooms,status:(asset?.status||'disponivel')as Property['status'],image:'',code:asset?.code,acquisitionDate:asset?.acquisition_date,purchaseValue:Number(asset?.purchase_value||0),currentValue:Number(asset?.current_value||0),rentDate:row.rent_date,annualAdjustmentDate:row.annual_adjustment_date,contractEndDate:row.contract_end_date};}));}).catch(()=>setProperties([]));},[]);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    type: 'Kitnet' as Property['type'],
    address: '',
    rentValue: '',
    bedrooms: '1',
    bathrooms: '1',
    area: '',
    status: 'disponivel' as Property['status'],
    image: '',
    tenant: '', acquisitionDate: '', purchaseValue: '', currentValue: '', annualAdjustmentDate: '', contractEndDate: ''
  });

  // Calculate live counts
  const metrics = useMemo(() => {
    const total = properties.length;
    const alugados = properties.filter(p => p.status === 'alugado').length;
    const vagos = properties.filter(p => p.status === 'disponivel').length;
    const totalRent = properties.reduce((acc, curr) => acc + curr.rentValue, 0);
    const occupancyRate = total > 0 ? Math.round((alugados / total) * 100) : 0;

    return {
      total,
      alugados,
      vagos,
      totalRent,
      occupancyRate
    };
  }, [properties]);

  // Handle Delete property asset
  const openEdit = (property: Property) => { setEditingId(property.id); setFormData({ name: property.name, type: property.type, address: property.address, rentValue: String(property.rentValue), bedrooms: String(property.bedrooms || 0), bathrooms: String(property.bathrooms || 1), area: String(property.area), status: property.status, image: property.image || '', tenant: property.tenant || '', acquisitionDate: property.acquisitionDate || '', purchaseValue: String(property.purchaseValue || ''), currentValue: String(property.currentValue || ''), annualAdjustmentDate: property.annualAdjustmentDate || '', contractEndDate: property.contractEndDate || '' }); setIsModalOpen(true); };
  const handleDeleteProperty = (id: string, reason: string) => {
    setVisualState('loading');
    setTimeout(() => {
      const remaining = properties.filter(p => p.id !== id);
      saveProperties(remaining);
      const removed = properties.find(p => p.id === id); if (removed) addDeletionLog({ recordType: 'imovel', originalId: removed.id, description: removed.name, company: 'IMÓVEIS', sourceModule: 'Imóveis', responsibleUser: 'Administrador 3A', reason, adminValidated: true });
      setProperties(remaining);
      setVisualState('idle');
    }, 400);
  };

  // Filtered properties list
  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
      // search match
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(query);
        const addressMatch = p.address.toLowerCase().includes(query);
        const tenantMatch = p.tenant?.toLowerCase().includes(query);
        if (!nameMatch && !addressMatch && !tenantMatch) return false;
      }
      // type match
      if (filterType !== 'Todos os Tipos' && p.type !== filterType) return false;
      // status match
      if (filterStatus !== 'Status: Todos') {
        const targetStatus = filterStatus.split(' ')[1].toLowerCase();
        if (p.status !== targetStatus) return false;
      }
      return true;
    });
  }, [properties, searchQuery, filterType, filterStatus]);

  // Create new property asset
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.address || !formData.rentValue) return;

    setIsModalOpen(false);
    setVisualState('loading');

    setTimeout(() => {
      const imgFallback = formData.image;
      const areaVal = parseInt(formData.area) || 45;
      const priceVal = parseFloat(formData.rentValue);

      const payload = {
        name: formData.name,
        type: formData.type,
        address: formData.address,
        rentValue: priceVal,
        bedrooms: parseInt(formData.bedrooms) || 0,
        bathrooms: parseInt(formData.bathrooms) || 1,
        area: areaVal,
        status: formData.status,
        image: imgFallback,
        acquisitionDate: formData.acquisitionDate || undefined,
        purchaseValue: Number(formData.purchaseValue) || undefined,
        currentValue: Number(formData.currentValue) || undefined,
        annualAdjustmentDate: formData.annualAdjustmentDate || undefined,
        contractEndDate: formData.contractEndDate || undefined,
        tenant: formData.tenant || undefined,
        rentDate: formData.status === 'alugado' ? new Date().toISOString().split('T')[0] : undefined
      };
      if (editingId) updateProperty({ ...properties.find(p => p.id === editingId)!, ...payload, id: editingId }); else addProperty(payload);

      setProperties(getProperties());
      setVisualState('success');

      // Clear Form state
      setFormData({
        name: '',
        type: 'Kitnet',
        address: '',
        rentValue: '',
        bedrooms: '1',
        bathrooms: '1',
        area: '',
        status: 'disponivel',
        image: '',
        tenant: '', acquisitionDate: '', purchaseValue: '', currentValue: '', annualAdjustmentDate: '', contractEndDate: ''
      });
      setEditingId(null);

      setTimeout(() => setVisualState('idle'), 1000);

    }, 700);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Action Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <h2 className="font-display font-black text-on-surface text-lg tracking-tight">Gestão Imobiliária</h2>
          <p className="text-xs text-secondary mt-0.5 font-sans">Acompanhamento de inventário e rentabilidade de ativos imóveis.</p>
        </div>

        <button 
          onClick={() => { setEditingId(null); setIsModalOpen(true); }}
          className="px-4 py-2.5 bg-primary-container text-on-primary-container font-display font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-95 active:scale-95 transition-all shadow-sm rounded-lg self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          NOVO IMÓVEL
        </button>
      </div>

      {/* Occupancy Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Total Units */}
        <div className="bg-white p-5 rounded-xl border border-outline-variant custom-shadow flex flex-col justify-between h-28">
          <div className="flex justify-between items-center text-xs font-bold text-secondary uppercase tracking-wider">
            <span>Total Unidades</span>
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <p className="font-display font-black text-2xl text-on-surface">{metrics.total}</p>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Imóveis cadastrados</span>
        </div>

        {/* Occupancy Progress */}
        <div className="bg-white p-5 rounded-xl border border-outline-variant custom-shadow flex flex-col justify-between h-28">
          <div className="flex justify-between items-center text-xs font-bold text-secondary uppercase tracking-wider">
            <span>Ocupação</span>
            <TrendingUp className="w-4 h-4 text-green-600" />
          </div>
          <p className="font-display font-black text-2xl text-on-surface">{metrics.occupancyRate}%</p>
          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
            <div className="bg-green-600 h-full transition-all duration-500" style={{ width: `${metrics.occupancyRate}%` }} />
          </div>
        </div>

        {/* Vacant Units */}
        <div className="bg-white p-5 rounded-xl border border-outline-variant custom-shadow flex flex-col justify-between h-28">
          <div className="flex justify-between items-center text-xs font-bold text-secondary uppercase tracking-wider">
            <span>Disponíveis (Vagos)</span>
            <Home className="w-4 h-4 text-error" />
          </div>
          <p className="font-display font-black text-2xl text-on-surface">{metrics.vagos}</p>
          <span className={`text-[10px] font-bold ${metrics.vagos > 0 ? 'text-error animate-pulse' : 'text-gray-400'}`}>
            {metrics.vagos > 0 ? 'Foco comercial necessário' : 'Portfólio 100% locado'}
          </span>
        </div>

        {/* Total Rent Revenue */}
        <div className="bg-white p-5 rounded-xl border border-outline-variant custom-shadow flex flex-col justify-between h-28">
          <div className="flex justify-between items-center text-xs font-bold text-secondary uppercase tracking-wider">
            <span>Faturamento Bruto</span>
            <span className="font-display font-black text-xs text-primary">R$</span>
          </div>
          <p className="font-display font-black text-xl text-primary">
            R$ {metrics.totalRent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Faturamento mensal bruto</span>
        </div>

      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-outline-variant custom-shadow flex flex-wrap items-center gap-4">
        
        {/* Search */}
        <div className="relative flex-grow min-w-[240px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, endereço ou locatário..."
            className="w-full bg-gray-50 pl-10 pr-4 py-2 border border-outline-variant rounded text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-container"
          />
        </div>

        {/* Type select */}
        <select 
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-white border border-outline-variant rounded px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
        >
          <option>Todos os Tipos</option>
          <option value="Kitnet">Kitnet</option>
          <option value="Casa">Casa</option>
          <option value="Loja">Loja</option>
          <option value="Industrial">Galpão Industrial</option>
          <option value="Comercial">Edifício Comercial</option>
        </select>

        {/* Status select */}
        <select 
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-white border border-outline-variant rounded px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
        >
          <option>Status: Todos</option>
          <option>Status: Disponivel</option>
          <option>Status: Alugado</option>
          <option>Status: Manutencao</option>
        </select>

        <button 
          onClick={() => {
            setSearchQuery('');
            setFilterType('Todos os Tipos');
            setFilterStatus('Status: Todos');
          }}
          className="px-4 py-2 border border-black hover:bg-black hover:text-white rounded text-xs font-display font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 focus:outline-none"
        >
          <SlidersHorizontal className="w-4 h-4" />
          LIMPAR FILTROS
        </button>
      </div>

      {/* Main Grid content with Sidebar */}
      <LoadingOverlay 
        state={visualState === 'idle' && filteredProperties.length === 0 ? 'empty' : visualState}
        emptyTitle="Nenhum imóvel cadastrado"
        emptyDesc="Nenhum imóvel corresponde aos critérios de busca definidos no painel."
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Properties cards grid */}
          <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {filteredProperties.map((p) => {
              return (
                <div key={p.id} role="button" tabIndex={0} onClick={() => navigate(`/bens/imovel/${p.id}`)} onKeyDown={e => e.key === 'Enter' && navigate(`/bens/imovel/${p.id}`)} className="bg-white border border-outline-variant rounded-xl overflow-hidden custom-shadow flex flex-col justify-between group hover:border-primary-container hover:-translate-y-0.5 cursor-pointer transition-all">
                  <div className="h-44 overflow-hidden relative">
                    <img 
                      src={assetImage(p.image, p.type)}
                      onError={event => useAssetFallback(event, p.type)}
                      alt={`${p.type} ${p.code || ''} — ${p.name}`}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent"/>
                    <div className={`absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${
                      p.status === 'alugado' ? 'bg-amber-100 text-amber-800' :
                      p.status === 'disponivel' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {p.status}
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-1.5">
                        <h4 className="font-display font-black text-on-surface text-sm tracking-tight">{p.name} <span className="text-primary">{p.code}</span></h4>
                        <button 
                          onClick={(event) => { event.stopPropagation(); setDeleteTarget(p); }}
                          className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"
                          title="Remover imóvel"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button onClick={(event) => { event.stopPropagation(); openEdit(p); }} title="Editar imóvel" className="p-1.5 text-secondary hover:text-primary"><Pencil className="w-4 h-4" /></button><button onClick={(event) => { event.stopPropagation(); navigate(`/bens/imovel/${p.id}`); }} className="text-[9px] font-bold text-primary">Ver detalhes</button>
                      </div>

                      <p className="text-[10px] text-secondary flex items-center gap-1 font-semibold uppercase tracking-wider mb-4">
                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                        {p.address}
                      </p>

                      <div className="flex gap-4 text-xs font-semibold text-secondary">
                        <span className="flex items-center gap-1"><BedDouble className="w-4 h-4" /> {p.bedrooms} {p.bedrooms === 1 ? 'Quarto' : 'Quartos'}</span>
                        <span className="flex items-center gap-1"><Bath className="w-4 h-4" /> {p.bathrooms} {p.bathrooms === 1 ? 'Banheiro' : 'Banheiros'}</span>
                        <span className="flex items-center gap-1"><Maximize2 className="w-4 h-4" /> {p.area}m²</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-outline-variant/30 flex justify-between items-center">
                      <div>
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Aluguel Estimado</span>
                        <span className="font-display font-black text-sm text-primary">
                          R$ {p.rentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {p.tenant && (
                        <div className="text-right">
                          <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider block">Inquilino</span>
                          <span className="text-xs font-bold text-on-surface">{p.tenant}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sidebar Highlight Box */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Quick Action notification automation */}
            <div className="bg-inverse-surface text-white rounded-xl p-5 shadow-lg flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-3">
                <Bolt className="w-5 h-5 text-primary-container animate-spin-slow" />
                <span className="font-display font-bold text-xs uppercase tracking-wider">Ação Rápida</span>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed mb-6">
                Consulte os reajustes cadastrados na Central de Alertas. O envio automatizado dependerá de integração futura.
              </p>

              <button 
                onClick={() => navigate('/alertas?tipo=Reajuste%20anual')}
                className="w-full py-3 bg-primary-fixed text-on-primary-fixed font-display font-bold text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2 focus:outline-none"
              >
                <Send className="w-4 h-4" />
                Ver Alertas de Reajuste
              </button>
            </div>

          </div>

        </div>
      </LoadingOverlay>

      {/* Create Property Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Imóvel" : "Adicionar Novo Imóvel"}>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold uppercase">Código automático</label><input readOnly value={editingId ? properties.find(p=>p.id===editingId)?.code || 'Sem código para este tipo' : 'Gerado ao salvar'} className="w-full border rounded p-2 text-xs bg-gray-50"/></div><div><label className="text-[10px] font-bold uppercase">Data de aquisição</label><input type="date" value={formData.acquisitionDate} onChange={e=>setFormData(p=>({...p,acquisitionDate:e.target.value}))} className="w-full border rounded p-2 text-xs"/></div></div>
          <div className="grid grid-cols-2 gap-4"><input aria-label="Valor de compra" type="number" placeholder="Valor de compra" value={formData.purchaseValue} onChange={e=>setFormData(p=>({...p,purchaseValue:e.target.value}))} className="border rounded p-2 text-xs"/><input aria-label="Valor atual" type="number" placeholder="Valor atual" value={formData.currentValue} onChange={e=>setFormData(p=>({...p,currentValue:e.target.value}))} className="border rounded p-2 text-xs"/></div>
          <div className="grid grid-cols-2 gap-4"><label className="text-[10px] font-bold uppercase">Próximo reajuste<input type="date" value={formData.annualAdjustmentDate} onChange={e=>setFormData(p=>({...p,annualAdjustmentDate:e.target.value}))} className="mt-1 w-full border rounded p-2 text-xs"/></label><label className="text-[10px] font-bold uppercase">Fim do contrato<input type="date" value={formData.contractEndDate} onChange={e=>setFormData(p=>({...p,contractEndDate:e.target.value}))} className="mt-1 w-full border rounded p-2 text-xs"/></label></div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Nome do Empreendimento</label>
            <input 
              type="text"
              required
              placeholder="Ex: Edifício Alpha Towers, Kitnet Central B4"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Tipo de Ativo</label>
              <select 
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as Property['type'] }))}
                className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container bg-white"
              >
                <option value="Kitnet">Kitnet</option>
                <option value="Casa">Casa</option>
                <option value="Loja">Loja Comercial</option>
                <option value="Industrial">Galpão Industrial</option>
                <option value="Comercial">Edifício Comercial</option>
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Status Inicial</label>
              <select 
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Property['status'] }))}
                className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container bg-white"
              >
                <option value="disponivel">Disponível (Vago)</option>
                <option value="alugado">Alugado</option>
                <option value="manutencao">Em Manutenção</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Endereço Completo</label>
            <input 
              type="text"
              required
              placeholder="Ex: Av. Copacabana, 1022 - Rio de Janeiro/RJ"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Quartos</label>
              <input 
                type="number"
                value={formData.bedrooms}
                onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: e.target.value }))}
                className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>
            
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Banheiros</label>
              <input 
                type="number"
                value={formData.bathrooms}
                onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: e.target.value }))}
                className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Área (m²)</label>
              <input 
                type="number"
                required
                placeholder="Ex: 45"
                value={formData.area}
                onChange={(e) => setFormData(prev => ({ ...prev, area: e.target.value }))}
                className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Aluguel Estimado (R$)</label>
              <input 
                type="number"
                required
                placeholder="0.00"
                value={formData.rentValue}
                onChange={(e) => setFormData(prev => ({ ...prev, rentValue: e.target.value }))}
                className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Inquilino (se Alugado)</label>
              <input 
                type="text"
                placeholder="Nome do locatário"
                value={formData.tenant}
                onChange={(e) => setFormData(prev => ({ ...prev, tenant: e.target.value }))}
                className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>
          </div>

          <div className="flex flex-col"><label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Foto real (opcional)</label><AssetPhotoField value={formData.image} type={formData.type} onChange={image=>setFormData(prev=>({...prev,image}))}/></div>

          <button 
            type="submit"
            className="w-full py-3 bg-primary-container text-on-primary-container font-display font-black text-xs uppercase tracking-widest rounded-lg hover:brightness-95 transition-all mt-4"
          >
            REGISTRAR PATRIMÔNIO
          </button>
        </form>
      </Modal>
      <DeleteConfirmation isOpen={!!deleteTarget} recordName={deleteTarget?.name || ''} onClose={() => setDeleteTarget(null)} onValidated={reason => { if (deleteTarget) handleDeleteProperty(deleteTarget.id, reason); setDeleteTarget(null); }} />

    </div>
  );
}
