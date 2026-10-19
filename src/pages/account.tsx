import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import type { Profile, Wallet } from '../domain/contracts'
import { errorMessage, fieldErrors } from '../lib/api'
import { useApiMutation, usePrivateQuery, useSession, useWallets } from '../lib/state'
import { EmptyState, ErrorState, Skeleton } from '../components/shared'
import { Button } from '../components/ui/button'
import { Field } from '../components/forms'

export function AccountLayout({ children }: { children: ReactNode }) {
  const { logout, notice } = useSession()
  return (
    <div className="account-layout">
      <aside className="account-sidebar">
        <h2>Meu perfil</h2>
        <nav aria-label="Minha conta">
          {[
            ['/perfil', 'Dados do perfil', 'browser-user-70420-4599.svg'],
            ['/carteiras', 'Carteiras', 'browser-location-70420-4602.svg'],
            ['/pedidos', 'Atividade', 'browser-shopping-1-70420-4605.svg'],
            ['/favoritos', 'Lista de interesse', 'browser-heart-1-70420-4609.svg'],
          ].map(([to, text, source]) => (
            <Link key={to} to={to} activeProps={{ className: 'active' }}>
              <img src={`/images/vectors/${source}`} alt="" />
              {text}
            </Link>
          ))}
          {[
            ['Ofertas', 'browser-activity-70420-4613.svg'],
            ['Arquivos baixados', 'browser-download-70420-4616.svg'],
            ['Suporte', 'browser-danger-triangle-70420-4619.svg'],
          ].map(([text, source]) => (
            <button
              key={text}
              onClick={() =>
                notice('Ainda estamos trabalhando nesta página. Ela estará disponível em breve.')
              }
            >
              <img src={`/images/vectors/${source}`} alt="" />
              {text}
            </button>
          ))}
          <button className="logout" onClick={() => void logout()}>
            <img
              src="/images/vectors/browser-logout-70420-4623.svg"
              alt=""
              width="20"
              height="20"
            />
            Sair
          </button>
        </nav>
      </aside>
      <section className="account-main">{children}</section>
    </div>
  )
}
export function ProfilePage() {
  const profile = usePrivateQuery<Profile>('profile')
  return (
    <AccountLayout>
      {profile.isPending ? (
        <Skeleton type="detail" />
      ) : profile.isError ? (
        <ErrorState error={profile.error} retry={() => void profile.refetch()} />
      ) : (
        <ProfileEditor key={profile.data.id} profile={profile.data} />
      )}
    </AccountLayout>
  )
}
function ProfileEditor({ profile }: { profile: Profile }) {
  const [avatar, setAvatar] = useState(profile.avatar),
    { notice } = useSession()
  const form = useForm<Profile & { currentPassword: string; password: string; confirm: string }>({
      defaultValues: { ...profile, currentPassword: '', password: '', confirm: '' },
    }),
    errors = form.formState.errors
  const save = useApiMutation<Partial<Profile>>(
    'patch',
    '/profile',
    ['profile', 'session'],
    'Perfil atualizado.',
  )
  return (
    <>
      <h1>Perfil do colecionador</h1>
      <form
        className="stack"
        onSubmit={form.handleSubmit((values) =>
          save.mutate(
            { ...values, avatar },
            {
              onSuccess: () => {
                form.resetField('currentPassword')
                form.resetField('password')
                form.resetField('confirm')
              },
              onError: (error) => {
                for (const [field, message] of Object.entries(fieldErrors(error)))
                  form.setError(field as keyof typeof values, { message })
              },
            },
          ),
        )}
        noValidate
      >
        <div className="form-grid">
          <Field
            label="Nome de exibição"
            required
            {...form.register('name', {
              required: 'Informe seu nome.',
              minLength: { value: 2, message: 'Use ao menos 2 caracteres.' },
            })}
            error={errors.name?.message}
          />
          <Field
            label="Nome de usuário"
            required
            {...form.register('username', {
              pattern: {
                value: /^\w{3,24}$/,
                message: 'Use de 3 a 24 letras, números ou sublinhado.',
              },
              required: 'Informe seu usuário.',
            })}
            error={errors.username?.message}
          />
          <Field
            label="E-mail"
            type="email"
            required
            {...form.register('email', {
              required: 'Informe seu e-mail.',
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'E-mail inválido.' },
            })}
            error={errors.email?.message}
          />
          <Field
            ens
            value={form.watch('ens')}
            label="Nome ENS"
            required
            {...form.register('ens', {
              required: 'Informe o nome ENS.',
              validate: (value) =>
                !value || /^[\w-]{3,30}\.eth$/.test(value) || 'Use um nome terminado em .eth.',
            })}
            error={errors.ens?.message}
          />
          <Field
            label="Apelido da carteira"
            required
            {...form.register('walletAlias', { required: 'Informe um apelido.' })}
            error={errors.walletAlias?.message}
          />
          <div className="field">
            <label htmlFor="avatar">Avatar</label>
            <div className="avatar-control">
              {avatar ? (
                <img src={avatar} alt="Seu avatar" width="50" height="50" />
              ) : (
                <img
                  src="/images/vectors/frame-32-129.svg"
                  alt="Sem avatar"
                  width="50"
                  height="50"
                />
              )}
              <label htmlFor="avatar" className="button button-primary">
                Alterar
              </label>
              <input
                className="sr-only"
                type="file"
                id="avatar"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  if (
                    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
                    file.size > 300_000
                  ) {
                    notice('Use PNG, JPEG ou WebP de até 300 KB.')
                    return
                  }
                  const reader = new FileReader()
                  reader.onload = () => setAvatar(String(reader.result))
                  reader.readAsDataURL(file)
                }}
              />
              <Button type="button" variant="ghost" size="sm" onClick={() => setAvatar('')}>
                Remover
              </Button>
            </div>
          </div>
        </div>
        <section className="password-form stack">
          <h2>Alterar senha</h2>
          <Field
            label="Senha atual"
            type="password"
            autoComplete="current-password"
            {...form.register('currentPassword', {
              validate: (value) =>
                !form.getValues('password') || !!value || 'Informe sua senha atual.',
            })}
            error={errors.currentPassword?.message}
          />
          <Field
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            {...form.register('password', {
              validate: (value) =>
                (!value && !form.getValues('currentPassword') && !form.getValues('confirm')) ||
                /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(value) ||
                'Use 8 caracteres, maiúscula, minúscula e número.',
            })}
            error={errors.password?.message}
          />
          <Field
            label="Confirmar nova senha"
            type="password"
            autoComplete="new-password"
            {...form.register('confirm', {
              validate: (value) =>
                value === form.getValues('password') || 'As senhas precisam ser iguais.',
            })}
            error={errors.confirm?.message}
          />
        </section>
        {save.isError && (
          <p className="field-error" role="alert">
            {errorMessage(save.error)}
          </p>
        )}
        <Button type="submit" disabled={save.isPending} className="align-start">
          {save.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </form>
    </>
  )
}
export function WalletsPage() {
  const wallets = useWallets(),
    [adding, setAdding] = useState(false),
    [copyPrimary, setCopyPrimary] = useState(false)
  return (
    <AccountLayout>
      <div className="section-heading">
        <h1>Carteira principal</h1>
        <Button variant="ghost" onClick={() => setAdding(true)}>
          Adicionar
        </Button>
      </div>
      <p className="muted">
        Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.
      </p>
      {wallets.isPending ? (
        <Skeleton type="detail" />
      ) : wallets.isError ? (
        <ErrorState error={wallets.error} retry={() => void wallets.refetch()} />
      ) : (
        <>
          {wallets.data.map((wallet) => (
            <WalletEditor key={`${wallet.id}:${wallet.primary}`} wallet={wallet} />
          ))}
          {!wallets.data.length && (
            <EmptyState
              title="Você ainda não cadastrou uma carteira"
              action={<Button onClick={() => setAdding(true)}>Cadastrar carteira</Button>}
            />
          )}
          {!wallets.data.some((wallet) => !wallet.primary) && (
            <section className="secondary-wallet-empty">
              <div className="section-heading">
                <h2>Carteira secundária</h2>
                <label className="inline copy-primary">
                  <input
                    type="checkbox"
                    checked={copyPrimary}
                    onChange={(event) => {
                      setCopyPrimary(event.target.checked)
                      setAdding(true)
                    }}
                  />
                  Igual à carteira principal
                </label>
                <Button variant="ghost" onClick={() => setAdding(true)}>
                  Adicionar
                </Button>
              </div>
              <p className="muted">Você ainda não adicionou uma carteira secundária.</p>
            </section>
          )}
          {adding && (
            <WalletEditor
              key={copyPrimary ? 'copy-primary' : 'new-wallet'}
              initialValues={
                copyPrimary ? wallets.data.find((wallet) => wallet.primary) : undefined
              }
              onSaved={() => {
                setAdding(false)
                setCopyPrimary(false)
              }}
              onCancel={() => {
                setAdding(false)
                setCopyPrimary(false)
              }}
            />
          )}
        </>
      )}
    </AccountLayout>
  )
}
function WalletEditor({
  wallet,
  onSaved,
  onCancel,
  initialValues,
}: {
  initialValues?: Wallet
  wallet?: Wallet
  onSaved?: () => void
  onCancel?: () => void
}) {
  const { user } = useSession(),
    form = useForm<Wallet>({
      defaultValues:
        wallet ??
        (initialValues
          ? { ...initialValues, id: undefined, primary: false }
          : {
              name: '',
              address: '',
              network: 'Ethereum',
              primary: false,
              displayName: user?.name,
              email: user?.email,
              profileName: user?.username,
              type: 'MetaMask',
              referral: 'KURIO',
              ens: `${user?.username}.eth`,
              secondaryAddress: '',
            }),
    }),
    errors = form.formState.errors
  const save = useApiMutation<Wallet>(
    wallet ? 'put' : 'post',
    wallet ? `/wallets/${wallet.id}` : '/wallets',
    ['wallets'],
    'Carteira salva.',
  )
  return (
    <form
      className="wallet-form stack"
      onSubmit={form.handleSubmit((values) =>
        save.mutate(values, {
          onSuccess: onSaved,
          onError: (error) => {
            for (const [field, message] of Object.entries(fieldErrors(error)))
              form.setError(field as keyof Wallet, { message })
          },
        }),
      )}
      noValidate
    >
      {(!wallet || !wallet.primary) && <h2>{wallet ? 'Carteira secundária' : 'Nova carteira'}</h2>}
      <div className="form-grid">
        <Field
          label="Nome de exibição"
          required
          {...form.register('displayName', { required: 'Informe o nome de exibição.' })}
          error={errors.displayName?.message}
        />
        <Field
          label="Apelido da carteira"
          required
          {...form.register('name', {
            required: 'Informe um apelido.',
            minLength: { value: 2, message: 'Use ao menos 2 caracteres.' },
          })}
          error={errors.name?.message}
        />
        <div className="field">
          <label htmlFor={`network-${wallet?.id ?? 'new'}`}>
            Rede <span className="required">*</span>
          </label>
          <select id={`network-${wallet?.id ?? 'new'}`} {...form.register('network')}>
            <option value="" disabled>
              Selecione uma rede
            </option>
            <option>Ethereum</option>
            <option>Polygon</option>
          </select>
        </div>
        <Field
          label="Nome do perfil"
          required
          {...form.register('profileName', { required: 'Informe o nome do perfil.' })}
          error={errors.profileName?.message}
        />
        <Field
          label="Endereço da carteira"
          placeholder="Endereço 0x da carteira"
          required
          {...form.register('address', {
            required: 'Informe o endereço.',
            pattern: {
              value: /^0x[\da-fA-F]{40}$/,
              message: 'Use 0x seguido de 40 caracteres hexadecimais.',
            },
          })}
          error={errors.address?.message}
        />
        <Field
          hiddenLabel
          placeholder="ENS ou carteira secundária (opcional)"
          label="ENS ou carteira secundária (opcional)"
          {...form.register('secondaryAddress', {
            validate: (value) =>
              !value ||
              /^0x[\da-fA-F]{40}$/.test(value) ||
              /^[\w-]+\.eth$/.test(value) ||
              'Informe endereço 0x ou nome .eth.',
          })}
          error={errors.secondaryAddress?.message}
        />
        <div className="field">
          <label htmlFor={`type-${wallet?.id ?? 'new'}`}>
            Tipo de carteira <span className="required">*</span>
          </label>
          <select id={`type-${wallet?.id ?? 'new'}`} {...form.register('type')}>
            <option value="" disabled>
              Selecione uma carteira
            </option>
            <option>MetaMask</option>
            <option>WalletConnect</option>
            <option>Coinbase Wallet</option>
          </select>
        </div>
        <Field
          label="Código de indicação"
          required
          {...form.register('referral', {
            required: 'Informe o código.',
            pattern: { value: /^[\w-]{3,30}$/, message: 'Use de 3 a 30 letras ou números.' },
          })}
          error={errors.referral?.message}
        />
        <Field
          label="E-mail"
          type="email"
          required
          {...form.register('email', {
            required: 'Informe um e-mail.',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'E-mail inválido.' },
          })}
          error={errors.email?.message}
        />
        <Field
          ens
          value={form.watch('ens')}
          label="Nome ENS"
          required
          {...form.register('ens', {
            required: 'Informe o nome ENS.',
            pattern: { value: /^[\w-]{3,30}\.eth$/, message: 'Use um nome terminado em .eth.' },
          })}
          error={errors.ens?.message}
        />
      </div>
      {save.isError && (
        <p role="alert" className="field-error">
          {errorMessage(save.error)}
        </p>
      )}
      <div className="inline">
        <Button disabled={save.isPending}>
          {save.isPending ? 'Salvando…' : 'Salvar carteira'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  )
}
