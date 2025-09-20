import { API_URL, CDN_URL } from '@constants'
import {
    ICustomerPaginationResult,
    ICustomerResult,
    IFile,
    IOrder,
    IOrderPaginationResult,
    IOrderResult,
    IProduct,
    IProductPaginationResult,
    ServerResponse,
    StatusType,
    UserLoginBodyDto,
    UserRegisterBodyDto,
    UserResponse,
} from '@types'

export const enum RequestStatus {
    Idle = 'idle',
    Loading = 'loading',
    Success = 'success',
    Failed = 'failed',
}

export type ApiListResponse<Type> = {
    total: number
    items: Type[]
}

class Api {
    private readonly baseUrl: string
    protected options: RequestInit
    private csrf = ''
    private csrfPromise: Promise<void> | null = null

    constructor(baseUrl: string, options: RequestInit = {}) {
        this.baseUrl = baseUrl
        this.options = {
            credentials: 'include',
            headers: { ...((options.headers as object) ?? {}) },
        }
    }

    private async loadCsrf() {
        const r = await fetch(`${this.baseUrl}/csrf-token`, {
            credentials: 'include',
        })
        const j = await r.json()
        this.csrf = j.csrfToken
    }

    private ensureCsrf() {
        if (this.csrf) return Promise.resolve()
        if (!this.csrfPromise) this.csrfPromise = this.loadCsrf()
        return this.csrfPromise
    }

    protected handleResponse<T>(response: Response): Promise<T> {
        return response.ok
            ? response.json()
            : response
                  .json()
                  .then((err) =>
                      Promise.reject({ ...err, statusCode: response.status })
                  )
    }

    protected async request<T>(endpoint: string, options: RequestInit) {
        const method = String(options.method || 'GET').toUpperCase()
        const headers: Record<string, string> = {
            ...((this.options.headers as Record<string, string>) || {}),
            ...((options.headers as Record<string, string>) || {}),
        }
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            await this.ensureCsrf()
            headers['X-CSRF-Token'] = this.csrf
        }
        const res = await fetch(`${this.baseUrl}${endpoint}`, {
            ...this.options,
            ...options,
            headers,
            credentials: 'include',
        })
        return this.handleResponse<T>(res)
    }

    private refreshToken = () => {
        return this.request<ServerResponse<unknown>>('/auth/token', {
            method: 'POST',
            credentials: 'include',
        })
    }

    protected requestWithRefresh = async <T>(
        endpoint: string,
        options: RequestInit
    ) => {
        try {
            return await this.request<T>(endpoint, options)
        } catch (error: any) {
            if (error?.statusCode !== 401 && error?.statusCode !== 403) {
                return Promise.reject(error)
            }
            const refreshData = await this.refreshToken()
            if (!(refreshData as any)?.ok && !(refreshData as any)?.success) {
                return Promise.reject(refreshData)
            }
            return this.request<T>(endpoint, options)
        }
    }
}

export interface IWebLarekAPI {
    getProductList: (
        filters: Record<string, unknown>
    ) => Promise<IProductPaginationResult>
    getProductItem: (id: string) => Promise<IProduct>
    createOrder: (order: IOrder) => Promise<IOrderResult>
}

export class WebLarekAPI extends Api implements IWebLarekAPI {
    readonly cdn: string

    constructor(cdn: string, baseUrl: string, options?: RequestInit) {
        super(baseUrl, options)
        this.cdn = cdn
    }

    getProductItem = (id: string): Promise<IProduct> => {
        return this.request<IProduct>(`/product/${id}`, { method: 'GET' }).then(
            (data: IProduct) => ({
                ...data,
                image: {
                    ...data.image,
                    fileName: this.cdn + data.image.fileName,
                },
            })
        )
    }

    getProductList = (
        filters: Record<string, unknown> = {}
    ): Promise<IProductPaginationResult> => {
        const queryParams = new URLSearchParams(
            filters as Record<string, string>
        ).toString()
        return this.request<IProductPaginationResult>(
            `/product?${queryParams}`,
            { method: 'GET' }
        ).then((data) => ({
            ...data,
            items: data.items.map((item) => ({
                ...item,
                image: {
                    ...item.image,
                    fileName: this.cdn + item.image.fileName,
                },
            })),
        }))
    }

    createOrder = (order: IOrder): Promise<IOrderResult> => {
        return this.requestWithRefresh<IOrderResult>('/order', {
            method: 'POST',
            body: JSON.stringify(order),
            headers: { 'Content-Type': 'application/json' },
        })
    }

    updateOrderStatus = (
        status: StatusType,
        orderNumber: string
    ): Promise<IOrderResult> => {
        return this.requestWithRefresh<IOrderResult>(`/order/${orderNumber}`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
            headers: { 'Content-Type': 'application/json' },
        })
    }

    getAllOrders = (
        filters: Record<string, unknown> = {}
    ): Promise<IOrderPaginationResult> => {
        const queryParams = new URLSearchParams(
            filters as Record<string, string>
        ).toString()
        return this.requestWithRefresh<IOrderPaginationResult>(
            `/order/all?${queryParams}`,
            {
                method: 'GET',
            }
        )
    }

    getCurrentUserOrders = (
        filters: Record<string, unknown> = {}
    ): Promise<IOrderPaginationResult> => {
        const queryParams = new URLSearchParams(
            filters as Record<string, string>
        ).toString()
        return this.requestWithRefresh<IOrderPaginationResult>(
            `/order/all/me?${queryParams}`,
            {
                method: 'GET',
            }
        )
    }

    getOrderByNumber = (orderNumber: string): Promise<IOrderResult> => {
        return this.requestWithRefresh<IOrderResult>(`/order/${orderNumber}`, {
            method: 'GET',
        })
    }

    getOrderCurrentUserByNumber = (
        orderNumber: string
    ): Promise<IOrderResult> => {
        return this.requestWithRefresh<IOrderResult>(
            `/order/me/${orderNumber}`,
            { method: 'GET' }
        )
    }

    loginUser = (data: UserLoginBodyDto) => {
        return this.request<UserResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        })
    }

    registerUser = (data: UserRegisterBodyDto) => {
        return this.request<UserResponse>('/auth/register', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
        })
    }

    getUser = () => {
        return this.requestWithRefresh<UserResponse>('/auth/user', {
            method: 'GET',
        })
    }

    getUserRoles = () => {
        return this.requestWithRefresh<string[]>('/auth/user/roles', {
            method: 'GET',
        })
    }

    getAllCustomers = (
        filters: Record<string, unknown> = {}
    ): Promise<ICustomerPaginationResult> => {
        const queryParams = new URLSearchParams(
            filters as Record<string, string>
        ).toString()
        return this.requestWithRefresh<ICustomerPaginationResult>(
            `/customers?${queryParams}`,
            {
                method: 'GET',
            }
        )
    }

    getCustomerById = (idCustomer: string) => {
        return this.requestWithRefresh<ICustomerResult>(
            `/customers/${idCustomer}`,
            { method: 'GET' }
        )
    }

    logoutUser = () => {
        return this.request<ServerResponse<unknown>>('/auth/logout', {
            method: 'POST',
            credentials: 'include',
        })
    }

    createProduct = (data: Omit<IProduct, '_id'>) => {
        return this.requestWithRefresh<IProduct>('/product', {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' },
        }).then((d: IProduct) => ({
            ...d,
            image: { ...d.image, fileName: this.cdn + d.image.fileName },
        }))
    }

    uploadFile = (data: FormData) => {
        return this.requestWithRefresh<IFile>('/upload', {
            method: 'POST',
            body: data,
        }).then((d) => ({ ...d, fileName: d.fileName }))
    }

    updateProduct = (data: Partial<Omit<IProduct, '_id'>>, id: string) => {
        return this.requestWithRefresh<IProduct>(`/product/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'application/json' },
        }).then((d: IProduct) => ({
            ...d,
            image: { ...d.image, fileName: this.cdn + d.image.fileName },
        }))
    }

    deleteProduct = (id: string) => {
        return this.requestWithRefresh<IProduct>(`/product/${id}`, {
            method: 'DELETE',
        })
    }
}

export default new WebLarekAPI(CDN_URL, API_URL)
