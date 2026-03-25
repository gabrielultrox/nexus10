export interface IErrorResponse {
  status: number
  code: string
  message: string
  timestamp: string
  path: string
}

export interface IPaginationParams {
  page?: number
  limit?: number
  sort?: string
  filter?: string
}

export interface IPaginatedResult<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface ISuccessResponse<T> {
  status: number
  data: T
  message?: string
  timestamp: string
}
