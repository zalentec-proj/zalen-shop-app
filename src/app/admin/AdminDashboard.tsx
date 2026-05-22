'use client';

import React from 'react';
import Link from 'next/link';
import {
  Package,
  ShoppingBag,
  Plug,
  Store,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowLeft,
} from 'lucide-react';
import type { Category, ProductSummary } from '@/modules/catalog/product.types';

interface Props {
  products: ProductSummary[];
  categories: Category[];
}

export default function AdminDashboard({ products, categories }: Props) {
  const totalProducts = products.length;
  const activeProducts = products.filter((product) => product.status === 'active').length;
  const totalStock = products.reduce((acc, product) => acc + product.stock, 0);

  const stats = [
    {
      label: 'Produtos',
      value: totalProducts,
      sub: `${activeProducts} ativos`,
      icon: Package,
      color: 'text-blue-primary',
      bg: 'bg-blue-primary/10',
      border: 'border-blue-primary/20',
      glow: 'shadow-[0_0_15px_rgba(30,61,255,0.15)]',
    },
    {
      label: 'Pedidos',
      value: 0,
      sub: 'Nenhum ainda',
      icon: ShoppingBag,
      color: 'text-green-accent',
      bg: 'bg-green-accent/10',
      border: 'border-green-accent/20',
      glow: 'shadow-[0_0_15px_rgba(0,230,118,0.15)]',
    },
    {
      label: 'Bling ERP',
      value: 'Pendente',
      sub: 'Conector ainda mockado',
      icon: Plug,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/20',
      glow: 'shadow-[0_0_15px_rgba(234,179,8,0.15)]',
    },
    {
      label: 'Status da loja',
      value: 'Online',
      sub: 'Modo demonstração',
      icon: Store,
      color: 'text-green-accent',
      bg: 'bg-green-accent/10',
      border: 'border-green-accent/20',
      glow: 'shadow-[0_0_15px_rgba(0,230,118,0.15)]',
    },
  ];

  const integrations = [
    {
      name: 'Bling ERP',
      description: 'Sincronização de produtos, estoque e pedidos',
      status: 'not_connected' as const,
      docs: 'https://developer.bling.com.br',
    },
    {
      name: 'Mercado Pago',
      description: 'Pagamentos via Pix, cartão e boleto',
      status: 'not_connected' as const,
      docs: 'https://www.mercadopago.com.br/developers/pt',
    },
    {
      name: 'Melhor Envio',
      description: 'Cotação e geração de etiquetas de frete',
      status: 'not_connected' as const,
      docs: 'https://docs.melhorenvio.com.br',
    },
  ];

  const statusConfig = {
    connected: { label: 'Conectado', icon: CheckCircle2, color: 'text-green-accent' },
    not_connected: { label: 'Não conectado', icon: AlertCircle, color: 'text-brand-muted' },
    error: { label: 'Erro', icon: AlertCircle, color: 'text-red-500' },
    pending: { label: 'Pendente', icon: Clock, color: 'text-yellow-500' },
  };

  return (
    <div className="min-h-screen bg-brand-bg relative">
      <div className="absolute top-[5%] left-[10%] w-[500px] h-[500px] rounded-full glow-radial pointer-events-none -z-10 opacity-20" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 md:px-8 py-4 bg-transparent">
        <nav className="max-w-7xl mx-auto h-[72px] px-6 rounded-full flex items-center justify-between navbar-glass shadow-[0_12px_32px_rgba(0,0,0,0.55)]">
          <Link href="/" className="flex items-center gap-2 text-brand-muted hover:text-white transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            Ver loja
          </Link>
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-blue-primary" />
            <span className="text-sm font-bold text-white">Painel Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-accent animate-pulse" />
            <span className="text-xs text-brand-muted">Demo</span>
          </div>
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-32 pb-20">

        {/* Page title */}
        <div className="mb-10">
          <p className="text-xs text-brand-muted uppercase tracking-widest mb-1">Brasil Drones & Parts</p>
          <h1 className="text-3xl md:text-4xl font-black text-white font-display">Dashboard</h1>
          <p className="text-sm text-brand-muted mt-2">
            Visão geral da loja — dados mockados, integrações pendentes.
          </p>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {stats.map(({ label, value, sub, icon: Icon, color, bg, border, glow }) => (
            <div
              key={label}
              className={`glass-panel rounded-2xl p-5 flex flex-col gap-4 border ${border} ${glow} transition-all hover:border-white/20`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-muted uppercase tracking-wider">{label}</span>
                <div className={`w-9 h-9 rounded-xl ${bg} border ${border} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${color}`} />
                </div>
              </div>
              <div>
                <p className={`text-3xl font-extrabold ${color} font-sans`}>{value}</p>
                <p className="text-xs text-brand-muted mt-1">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Products list */}
          <div className="lg:col-span-2 glass-panel rounded-2xl p-6 flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Produtos do catálogo</h2>
              <span className="text-xs text-brand-muted">{totalProducts} produtos</span>
            </div>

            <div className="flex flex-col gap-3">
              {products.map((product) => {
                const price = product.price;
                const stock = product.stock;
                return (
                  <div
                    key={product.id}
                    className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.02] border border-brand-border-soft hover:border-white/10 transition-all"
                  >
                    {/* Image */}
                    <div className="w-12 h-12 rounded-lg bg-white/[0.03] border border-brand-border-soft flex items-center justify-center overflow-hidden shrink-0">
                      {product.imageUrl && (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{product.name}</p>
                      <p className="text-[11px] text-brand-muted">
                        {product.categories[0]?.name ?? 'Catálogo'} · Status: {product.status}
                      </p>
                    </div>

                    {/* Price + Stock */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-green-accent">
                        R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className={`text-[11px] ${stock <= 5 ? 'text-yellow-500' : 'text-brand-muted'}`}>
                        {stock} em estoque
                      </p>
                    </div>

                    {/* Status badge */}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                      product.status === 'active'
                        ? 'text-green-accent bg-green-accent/10 border-green-accent/20'
                        : 'text-brand-muted bg-white/5 border-brand-border'
                    }`}>
                      {product.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>

                    <Link
                      href={`/produto/${product.slug}`}
                      className="p-1.5 rounded-lg text-brand-muted hover:text-blue-primary hover:bg-blue-primary/10 transition-all shrink-0"
                      title="Ver produto"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-5">

            {/* Integrations */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col gap-5">
              <div className="flex items-center gap-2">
                <Plug className="w-4 h-4 text-blue-primary" />
                <h2 className="text-base font-bold text-white">Integrações</h2>
              </div>

              <div className="flex flex-col gap-3">
                {integrations.map((integration) => {
                  const cfg = statusConfig[integration.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <div
                      key={integration.name}
                      className="p-4 rounded-xl bg-white/[0.02] border border-brand-border-soft flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{integration.name}</span>
                        <div className={`flex items-center gap-1 ${cfg.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          <span className="text-[11px] font-medium">{cfg.label}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-brand-muted">{integration.description}</p>
                      <a
                        href={integration.docs}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-blue-primary hover:underline flex items-center gap-1 w-fit"
                      >
                        Ver documentação <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Store status */}
            <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-green-accent" />
                <h2 className="text-base font-bold text-white">Status da loja</h2>
              </div>

              <div className="flex flex-col gap-2 text-sm">
                {[
                  { label: 'Ambiente', value: 'Desenvolvimento', ok: true },
                  { label: 'Banco de dados', value: 'Mock (sem Supabase)', ok: false },
                  { label: 'Pagamentos', value: 'Não configurado', ok: false },
                  { label: 'Frete', value: 'Não configurado', ok: false },
                  { label: 'ERP', value: 'Não conectado', ok: false },
                  { label: 'Categorias', value: `${categories.length} cadastradas`, ok: true },
                  { label: 'Estoque mockado', value: `${totalStock} itens`, ok: true },
                ].map(({ label, value, ok }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 border-b border-brand-border-soft last:border-0">
                    <span className="text-brand-muted text-xs">{label}</span>
                    <span className={`text-xs font-medium ${ok ? 'text-green-accent' : 'text-brand-muted'}`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-blue-primary/5 border border-blue-primary/20 text-xs text-brand-muted">
                <span className="text-blue-primary font-bold">Sprint 2:</span> Conectar Supabase, implementar Bling e Mercado Pago.
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
