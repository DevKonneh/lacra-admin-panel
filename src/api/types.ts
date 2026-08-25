export interface ApiResponse<T = any> {
    status: boolean;
    errors: string[] | object[];
    data: T;
    message: string;
}
