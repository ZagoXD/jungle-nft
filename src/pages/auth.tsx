import { safeNext } from '../lib/navigation'
import { useState, type MouseEvent } from 'react'
import { Link, useLocation, useNavigate, useSearch } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { api, errorMessage, fieldErrors } from '../lib/api'
import { useSession } from '../lib/state'
import { Dialog } from '../components/ui/dialog'
import { Button } from '../components/ui/button'
import { Field } from '../components/forms'
import { CatalogPage } from './catalog'

const authSchema = z.object({
  name: z.string(),
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe sua senha.'),
  confirmPassword: z.string(),
})
type AuthFields = z.infer<typeof authSchema>
export function AuthPage({
  inline = false,
  onClose,
  onAuthenticated,
}: {
  inline?: boolean
  onClose?: () => void
  onAuthenticated?: () => void
} = {}) {
  const [inlineSignup, setInlineSignup] = useState(false)
  const location = useLocation(),
    signup = inline ? inlineSignup : location.pathname === '/cadastro',
    search = useSearch({ strict: false }) as { next?: string },
    navigate = useNavigate(),
    { establish, notice } = useSession()
  const [help, setHelp] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<AuthFields>({
    resolver: zodResolver(authSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })
  const mutation = useMutation({
    mutationFn: async (input: AuthFields) => {
      const response = await api.post<{ token: string }>(
        signup ? '/session/register' : '/session/login',
        input,
      )
      await establish(response.data.token)
      return response.data
    },
    onSuccess: () => {
      notice(signup ? 'Conta criada. Bem-vindo à Kurio!' : 'Bem-vindo de volta!')
      if (inline) onAuthenticated?.()
      else void navigate({ to: safeNext(search.next) })
    },
    onError: (error) => {
      for (const [name, message] of Object.entries(fieldErrors(error)))
        setError(name as keyof AuthFields, { message })
    },
  })
  const submit = handleSubmit((values) => {
    if (signup) {
      if (values.name.trim().length < 2) {
        setError('name', { message: 'Informe seu nome.' })
        return
      }
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(values.password)) {
        setError('password', { message: 'Use 8 caracteres, maiúscula, minúscula e número.' })
        return
      }
      if (values.password !== values.confirmPassword) {
        setError('confirmPassword', { message: 'As senhas precisam ser iguais.' })
        return
      }
    }
    mutation.mutate(values)
  })
  const changeMode = (event: MouseEvent<HTMLAnchorElement>, value: boolean) => {
    if (!inline) return
    event.preventDefault()
    setInlineSignup(value)
    setHelp(false)
  }
  return (
    <>
      {!inline && (
        <div aria-hidden="true" inert>
          <CatalogPage />
        </div>
      )}
      <Dialog
        open
        className="auth-dialog"
        returnFocusId={inline ? 'cart-checkout' : undefined}
        onOpenChange={(open) => {
          if (!open) {
            if (inline) onClose?.()
            else
              void navigate({
                to: String(search.next).startsWith('/pagamento') ? '/carrinho' : '/',
              })
          }
        }}
        title={signup ? 'Criar conta' : 'Entrar'}
        description={
          signup
            ? 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'
            : 'Entre para gerenciar sua carteira, coleção e perfil de criador.'
        }
      >
        <img
          className="auth-mobile-logo"
          src="/images/vectors/browser-logo-70399-239.svg"
          alt="KURIO"
          width="358"
          height="136"
        />
        <div className="auth-tabs">
          <Link
            to="/login"
            search={{ next: search.next }}
            className={!signup ? 'selected' : ''}
            onClick={(event) => changeMode(event, false)}
          >
            Entrar
          </Link>
          <span>|</span>
          <Link
            to="/cadastro"
            search={{ next: search.next }}
            className={signup ? 'selected' : ''}
            onClick={(event) => changeMode(event, true)}
          >
            <span className="desktop-only">Criar conta</span>
            <span className="mobile-only">Criar perfil de colecionador</span>
          </Link>
        </div>
        <form className="auth-form stack" data-signup={signup} onSubmit={submit} noValidate>
          {signup && (
            <Field
              label="Nome de usuário"
              autoComplete="name"
              placeholder="Nome de usuário"
              required
              error={errors.name?.message}
              {...register('name')}
            />
          )}
          <Field
            label="E-mail"
            type="email"
            autoComplete="email"
            placeholder="Digite seu e-mail"
            required
            error={errors.email?.message}
            {...register('email')}
          />
          <Field
            label="Senha"
            type="password"
            autoComplete={signup ? 'new-password' : 'current-password'}
            placeholder="Senha"
            required
            error={errors.password?.message}
            {...register('password')}
          />
          {signup && (
            <Field
              label="Confirmar senha"
              type="password"
              autoComplete="new-password"
              placeholder="Confirmar senha"
              required
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
          )}
          {!signup && (
            <button
              className="text-button forgot-link"
              type="button"
              onClick={() => setHelp((value) => !value)}
            >
              Esqueceu a senha?
            </button>
          )}
          {help && (
            <p className="muted">
              Estamos preparando a recuperação de senha. Você poderá redefini-la por e-mail em
              breve.
            </p>
          )}
          {mutation.isError && (
            <p className="field-error" role="alert">
              {errorMessage(mutation.error)}
            </p>
          )}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              'Aguarde…'
            ) : signup ? (
              <>
                <span className="desktop-only">Criar conta</span>
                <span className="mobile-only">Criar perfil</span>
              </>
            ) : (
              'Entrar'
            )}
          </Button>
        </form>
        <div className="social-auth">
          <p>Ou continue com</p>
          <Button
            variant="outline"
            onClick={() =>
              notice(
                'O acesso com esta conta estará disponível em breve. Por enquanto, entre com seu e-mail.',
              )
            }
          >
            <img src="/images/vectors/google-1-100.svg" alt="" width="20" height="20" />
            Continuar com Google
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              notice(
                'O acesso com esta conta estará disponível em breve. Por enquanto, entre com seu e-mail.',
              )
            }
          >
            <img src="/images/vectors/facebook-1-101.svg" alt="" width="20" height="20" />
            Continuar com Facebook
          </Button>
        </div>
        <p className="auth-mobile-footer">
          {signup ? (
            <Link
              to="/login"
              search={{ next: search.next }}
              onClick={(event) => changeMode(event, false)}
            >
              Já tem uma conta? Entre
            </Link>
          ) : (
            <Link
              to="/cadastro"
              search={{ next: search.next }}
              onClick={(event) => changeMode(event, true)}
            >
              Novo na Kurio? Crie uma conta
            </Link>
          )}
        </p>
      </Dialog>
    </>
  )
}
