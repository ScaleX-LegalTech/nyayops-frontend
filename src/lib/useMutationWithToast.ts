import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { ApiError } from '@/lib/api/client'
import { useToast } from '@/components/ui/Toast'

type Options<TData, TVariables> = UseMutationOptions<TData, unknown, TVariables> & {
  errorFallback: string | ((err: unknown) => string)
}

/** Wraps useMutation with the shared err-instanceof-ApiError-to-toast error handling. */
export function useMutationWithToast<TData, TVariables = void>(
  options: Options<TData, TVariables>,
) {
  const { toast } = useToast()
  const { errorFallback, onError, ...rest } = options
  return useMutation({
    ...rest,
    onError: (err, variables, onMutateResult, context) => {
      const fallback = typeof errorFallback === 'function' ? errorFallback(err) : errorFallback
      toast(err instanceof ApiError ? err.message : fallback, 'error')
      onError?.(err, variables, onMutateResult, context)
    },
  })
}
