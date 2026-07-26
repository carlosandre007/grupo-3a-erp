import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Search, 
  SlidersHorizontal,
  Plus,
  Trash2,
  Mail,
  Phone,
  MapPin,
  CheckCircle,
  Building,
  User,
  ExternalLink, Pencil
} from 'lucide-react';
import { getClients, addClient, saveClients, updateClient, addDeletionLog } from '../mockData';
import { Client } from '../types';
import LoadingOverlay from '../components/LoadingOverlay';
import Modal from '../components/Modal';
import DeleteConfirmation from '../components/DeleteConfirmation';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { repository } from '../repositories';
import type { EntityRecord } from '../repositories';

export default function Clientes() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>(() => repository.kind==='supabase'?[]:getClients());
  const [visualState, setVisualState] = useState<'idle' | 'loading' | 'empty' | 'success'>('idle');

  // Search/Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('Todos');

  // Modal control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [searchParams] = useSearchParams();
  const [companyRows,setCompanyRows]=useState<Array<EntityRecord&{name?:string}>>([]);
  useEffect(()=>{repository.list<EntityRecord&{name?:string}>('companies').then(setCompanyRows).catch(()=>setCompanyRows([]));if(repository.kind==='supabase')repository.list<EntityRecord&{name:string;email?:string;phone?:string;document?:string;person_type?:Client['type'];address?:string;cnh_number?:string;cnh_expiry?:string;company_id?:string}>('clients').then(rows=>setClients(rows.map(row=>({id:row.id,name:row.name,email:row.email||'',phone:row.phone||'',document:row.document||'',type:row.person_type||'PF',address:row.address||'',cnhNumber:row.cnh_number,cnhExpiry:row.cnh_expiry,acquisitionCompanyId:row.company_id})))).catch(()=>setClients([]))},[]);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    document: '',
    type: 'PF' as Client['type'],
    address: '',
    cnhNumber: '',
    cnhExpiry: '', acquisitionDate:'', acquisitionSource:'', acquisitionCampaign:'', acquisitionChannel:'', acquisitionCompanyId:''
  });

  const maskDocument = (value: string, type: Client['type']) => {
    const digits = value.replace(/\D/g, '').slice(0, type === 'PF' ? 11 : 14);
    return type === 'PF' ? digits.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2') : digits.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  };
  const openEdit = (client: Client) => { setEditingId(client.id); setFormData({ name: client.name, email: client.email, phone: client.phone, document: client.document, type: client.type, address: client.address || '', cnhNumber: client.cnhNumber || '', cnhExpiry: client.cnhExpiry || '',acquisitionDate:client.acquisitionDate||'',acquisitionSource:client.acquisitionSource||'',acquisitionCampaign:client.acquisitionCampaign||'',acquisitionChannel:client.acquisitionChannel||'',acquisitionCompanyId:client.acquisitionCompanyId||'' }); setIsModalOpen(true); };
  useEffect(() => { const id = searchParams.get('edit'); const client = clients.find(c => c.id === id); if (client) openEdit(client); if(searchParams.get('new')==='1'){setEditingId(null);setIsModalOpen(true)} }, [searchParams]);

  // Metrics
  const stats = useMemo(() => {
    const total = clients.length;
    const pf = clients.filter(c => c.type === 'PF').length;
    const pj = clients.filter(c => c.type === 'PJ').length;

    return { total, pf, pj };
  }, [clients]);

  // Delete customer
  const handleDeleteClient = (id: string, reason: string) => {
    setVisualState('loading');
    setTimeout(() => {
      const remaining = clients.filter(c => c.id !== id);
      saveClients(remaining);
      const removed = clients.find(c => c.id === id); if (removed) addDeletionLog({ recordType: 'cliente', originalId: removed.id, description: removed.name, company: 'GRUPO 3A', sourceModule: 'Clientes', responsibleUser: 'Administrador 3A', reason, adminValidated: true });
      setClients(remaining);
      setVisualState('idle');
    }, 400);
  };

  // Filter clients
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const nameMatch = c.name.toLowerCase().includes(query);
        const emailMatch = c.email.toLowerCase().includes(query);
        const docMatch = c.document.includes(query);
        if (!nameMatch && !emailMatch && !docMatch) return false;
      }
      if (filterType !== 'Todos' && c.type !== filterType) return false;
      return true;
    });
  }, [clients, searchQuery, filterType]);

  // Create client
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.phone) return;

    setIsModalOpen(false);
    setVisualState('loading');

    setTimeout(() => {
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        document: formData.document || '000.000.000-00',
        type: formData.type,
        address: formData.address || 'Brasília/DF',
        activeContracts: editingId ? clients.find(c => c.id === editingId)?.activeContracts : 1,
        cnhNumber: formData.cnhNumber || undefined,
        cnhExpiry: formData.cnhExpiry || undefined
        ,acquisitionDate:formData.acquisitionDate||undefined,acquisitionSource:formData.acquisitionSource||undefined,acquisitionCampaign:formData.acquisitionCampaign||undefined,acquisitionChannel:formData.acquisitionChannel||undefined,acquisitionCompanyId:formData.acquisitionCompanyId||undefined,acquisitionCompany:companyRows.find(c=>c.id===formData.acquisitionCompanyId)?.name as Client['acquisitionCompany']
      };
      if (editingId) updateClient({ ...clients.find(c => c.id === editingId)!, ...payload, id: editingId }); else addClient(payload);

      setClients(getClients());
      setVisualState('success');

      // Reset
      setFormData({
        name: '',
        email: '',
        phone: '',
        document: '',
        type: 'PF',
        address: ''
        ,cnhNumber: '', cnhExpiry: '',acquisitionDate:'',acquisitionSource:'',acquisitionCampaign:'',acquisitionChannel:'',acquisitionCompanyId:''
      });
      setEditingId(null);

      setTimeout(() => setVisualState('idle'), 1000);

    }, 700);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/30 pb-4">
        <div>
          <h2 className="font-display font-black text-on-surface text-lg tracking-tight">Gestão de Clientes</h2>
          <p className="text-xs text-secondary mt-0.5 font-sans">Contatos, contratos ativos e cadastro unificado do Grupo 3A.</p>
        </div>

        <button 
          onClick={() => { setEditingId(null); setIsModalOpen(true); }}
          className="px-4 py-2.5 bg-primary-container text-on-primary-container font-display font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-95 active:scale-95 transition-all shadow-sm rounded-lg self-start sm:self-center"
        >
          <Plus className="w-4 h-4" />
          NOVO CLIENTE
        </button>
      </div>

      {/* Stats Bento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-xl border border-outline-variant custom-shadow flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-secondary uppercase tracking-wider">Total de Clientes</p>
            <p className="font-display font-black text-2xl text-on-surface mt-1">{stats.total}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-primary border border-outline-variant/30">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-outline-variant custom-shadow flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-secondary uppercase tracking-wider">Pessoa Física (PF)</p>
            <p className="font-display font-black text-2xl text-on-surface mt-1">{stats.pf}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-700 border border-green-100">
            <User className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-outline-variant custom-shadow flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-secondary uppercase tracking-wider">Pessoa Jurídica (PJ)</p>
            <p className="font-display font-black text-2xl text-on-surface mt-1">{stats.pj}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 border border-blue-100">
            <Building className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-outline-variant custom-shadow flex flex-wrap items-center gap-4">
        
        {/* Search */}
        <div className="relative flex-grow min-w-[240px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, email, documento..."
            className="w-full bg-gray-50 pl-10 pr-4 py-2 border border-outline-variant rounded text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary-container"
          />
        </div>

        {/* Type select */}
        <select 
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-white border border-outline-variant rounded px-3 py-2 text-xs font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
        >
          <option value="Todos">Todos os Tipos</option>
          <option value="PF">Pessoa Física (PF)</option>
          <option value="PJ">Pessoa Jurídica (PJ)</option>
        </select>

        <button 
          onClick={() => {
            setSearchQuery('');
            setFilterType('Todos');
          }}
          className="px-4 py-2 border border-black hover:bg-black hover:text-white rounded text-xs font-display font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 focus:outline-none"
        >
          <SlidersHorizontal className="w-4 h-4" />
          LIMPAR FILTROS
        </button>
      </div>

      {/* Customers Table */}
      <LoadingOverlay 
        state={visualState === 'idle' && filteredClients.length === 0 ? 'empty' : visualState}
        emptyTitle="Nenhum cliente cadastrado"
        emptyDesc="Não localizamos clientes cadastrados com os filtros aplicados."
      >
        <div className="bg-white rounded-xl border border-outline-variant custom-shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-outline-variant/50 text-secondary">
                  <th className="px-6 py-4 font-display font-bold text-xs uppercase tracking-wider">Nome</th>
                  <th className="px-6 py-4 font-display font-bold text-xs uppercase tracking-wider">Contato</th>
                  <th className="px-6 py-4 font-display font-bold text-xs uppercase tracking-wider">Documento</th>
                  <th className="px-6 py-4 font-display font-bold text-xs uppercase tracking-wider">Endereço</th>
                  <th className="px-6 py-4 font-display font-bold text-xs uppercase tracking-wider text-center">Contratos</th>
                  <th className="px-6 py-4 font-display font-bold text-xs uppercase tracking-wider text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30 text-xs text-on-surface font-medium">
                {filteredClients.map((c) => {
                  return (
                    <tr key={c.id} onClick={() => navigate(`/clientes/${c.id}`)} className="hover:bg-gray-50/50 cursor-pointer transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-inner ${
                            c.type === 'PF' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {c.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-on-surface">{c.name}</p>
                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wide">Pessoa {c.type}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1 text-secondary">
                          <p className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-gray-400" /> {c.email}</p>
                          <p className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-gray-400" /> {c.phone}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-secondary whitespace-nowrap">
                        {c.document}
                      </td>
                      <td className="px-6 py-4 text-secondary">
                        <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-400" /> {c.address}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-gray-100 border border-outline-variant/50 text-[10px] font-bold text-on-surface rounded-sm uppercase">
                          {c.activeContracts} ATIVOS
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={(event) => { event.stopPropagation(); setDeleteTarget(c); }}
                            className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded transition-colors"
                            title="Remover cliente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button onClick={(event) => { event.stopPropagation(); openEdit(c); }} title="Editar cliente" className="p-1.5 text-secondary hover:text-primary"><Pencil className="w-4 h-4" /></button><button onClick={(event)=>{event.stopPropagation();navigate(`/clientes/${c.id}`)}} className="text-[10px] font-bold text-primary">Ver detalhes</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </LoadingOverlay>

      {/* Modal create client */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Cliente" : "Adicionar Novo Cliente"}>
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Nome Completo / Razão Social</label>
            <input 
              type="text"
              required
              placeholder="Nome completo ou razão social"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">E-mail para Faturamento</label>
              <input 
                type="email"
                required
                placeholder="Ex: joao@financeiro.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">WhatsApp / Telefone</label>
              <input 
                type="text"
                required
                placeholder="Ex: (61) 98765-4321"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">CPF ou CNPJ</label>
              <input 
                type="text"
                required
                placeholder="Ex: 000.000.000-00"
                value={formData.document}
                onChange={(e) => setFormData(prev => ({ ...prev, document: maskDocument(e.target.value, prev.type) }))}
                className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Tipo de Inscrição</label>
              <select 
                value={formData.type}
                onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as Client['type'] }))}
                className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container bg-white"
              >
                <option value="PF">Pessoa Física (CPF)</option>
                <option value="PJ">Pessoa Jurídica (PJ)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-secondary uppercase tracking-wider mb-1.5">Endereço Principal</label>
            <input 
              type="text"
              placeholder="Ex: Setor de Clubes Sul, Brasília/DF"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="border border-outline-variant p-2.5 rounded text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
            />
          </div>
          {formData.type === 'PF' && <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-secondary uppercase">Número da CNH (opcional)</label><input value={formData.cnhNumber} onChange={e => setFormData(p => ({...p, cnhNumber: e.target.value.replace(/\D/g,'').slice(0,11)}))} className="w-full border border-outline-variant rounded p-2 text-xs" /></div><div><label className="text-[10px] font-bold text-secondary uppercase">Vencimento da CNH</label><input type="date" value={formData.cnhExpiry} onChange={e => setFormData(p => ({...p, cnhExpiry: e.target.value}))} className="w-full border border-outline-variant rounded p-2 text-xs" /></div></div>}
          <fieldset className="rounded border p-4"><legend className="px-2 text-xs font-black uppercase">Aquisição do cliente</legend><label className="text-[10px] font-bold uppercase">Empresa<select value={formData.acquisitionCompanyId} onChange={e=>setFormData(p=>({...p,acquisitionCompanyId:e.target.value,acquisitionCampaign:'',acquisitionSource:'',acquisitionChannel:''}))} className="w-full border p-2 text-xs"><option value="">Selecione</option>{companyRows.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</select></label><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-[10px] font-bold uppercase">Data de aquisição<input type="date" value={formData.acquisitionDate} onChange={e=>setFormData(p=>({...p,acquisitionDate:e.target.value}))} className="w-full border p-2 text-xs"/></label><label className="text-[10px] font-bold uppercase">Origem<input value={formData.acquisitionSource} onChange={e=>setFormData(p=>({...p,acquisitionSource:e.target.value}))} className="w-full border p-2 text-xs"/></label><label className="text-[10px] font-bold uppercase">Campanha<input value={formData.acquisitionCampaign} onChange={e=>setFormData(p=>({...p,acquisitionCampaign:e.target.value}))} className="w-full border p-2 text-xs"/></label><label className="text-[10px] font-bold uppercase">Canal<input value={formData.acquisitionChannel} onChange={e=>setFormData(p=>({...p,acquisitionChannel:e.target.value}))} className="w-full border p-2 text-xs"/></label></div></fieldset>

          <button 
            type="submit"
            className="w-full py-3 bg-primary-container text-on-primary-container font-display font-black text-xs uppercase tracking-widest rounded-lg hover:brightness-95 transition-all mt-4"
          >
            CONFIRMAR CADASTRO CLIENTE
          </button>
        </form>
      </Modal>
      <DeleteConfirmation isOpen={!!deleteTarget} recordName={deleteTarget?.name || ''} onClose={() => setDeleteTarget(null)} onValidated={reason => { if (deleteTarget) handleDeleteClient(deleteTarget.id, reason); setDeleteTarget(null); }} />

    </div>
  );
}
