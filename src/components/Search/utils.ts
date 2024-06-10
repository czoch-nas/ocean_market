import { LoggerInstance } from '@oceanprotocol/lib'
import {
  escapeEsReservedCharacters,
  generateBaseQuery,
  getFilterTerm,
  parseFilters,
  queryMetadata
} from '@utils/aquarius'
import queryString from 'query-string'
import { CancelToken } from 'axios'
import {
  SortDirectionOptions,
  SortTermOptions,
  TypesenseSearchParams
} from '../../@types/aquarius/SearchQuery'
import { filterSets, getInitialFilters } from './Filter'
import { filterBy } from '@components/Search/typesense'

export function updateQueryStringParameter(
  uri: string,
  key: string,
  newValue: string
): string {
  const regex = new RegExp('([?&])' + key + '=.*?(&|$)', 'i')
  const separator = uri.indexOf('?') !== -1 ? '&' : '?'

  if (uri.match(regex)) {
    return uri.replace(regex, '$1' + key + '=' + newValue + '$2')
  } else {
    return uri + separator + key + '=' + newValue
  }
}

export function getSearchQuery(
  chainIds: number[],
  text?: string,
  owner?: string,
  tags?: string,
  page?: string,
  offset?: string,
  sort?: string,
  sortDirection?: string,
  serviceType?: string | string[],
  accessType?: string | string[],
  filterSet?: string | string[]
): TypesenseSearchParams {
  const f = getInitialFilters({ accessType, serviceType, filterSet }, [
    'accessType',
    'serviceType',
    'filterSet'
  ])

  return {
    q: escapeEsReservedCharacters(text) || '*',
    query_by: '',
    filter_by: filterBy(f),
    page: page ? parseInt(page) : 1,
    sort_by: `${sort}:${sortDirection}`
  }
}

export async function getResults(
  params: {
    text?: string
    owner?: string
    tags?: string
    categories?: string
    page?: string
    offset?: string
    sort?: string
    sortOrder?: string
    serviceType?: string | string[]
    accessType?: string | string[]
    filterSet?: string[]
  },
  chainIds: number[],
  cancelToken?: CancelToken
): Promise<PagedAssets> {
  const {
    text,
    owner,
    tags,
    page,
    offset,
    sort,
    sortOrder,
    serviceType,
    accessType,
    filterSet
  } = params

  const searchQuery = getSearchQuery(
    chainIds,
    text,
    owner,
    tags,
    page,
    offset,
    sort,
    sortOrder,
    serviceType,
    accessType,
    filterSet
  )
  const queryResult = await queryMetadata(searchQuery, cancelToken)

  // update queryResult to workaround the wrong return datatype of totalPages and totalResults
  return queryResult?.results?.length === 0
    ? {
        ...queryResult,
        totalPages: 0,
        totalResults: 0
      }
    : queryResult
}

export async function addExistingParamsToUrl(
  location: Location,
  excludedParams: string[]
): Promise<string> {
  const parsed = queryString.parse(location.search)
  let urlLocation = '/search?'
  if (Object.keys(parsed).length > 0) {
    for (const queryParam in parsed) {
      if (!excludedParams.includes(queryParam)) {
        if (queryParam === 'page' && excludedParams.includes('text')) {
          LoggerInstance.log('remove page when starting a new search')
        } else {
          const value = parsed[queryParam]
          urlLocation = `${urlLocation}${queryParam}=${value}&`
        }
      }
    }
  } else {
    // sort should be relevance when fixed in aqua
    urlLocation = `${urlLocation}sort=${encodeURIComponent(
      SortTermOptions.Created
    )}&sortOrder=${SortDirectionOptions.Descending}&`
  }
  urlLocation = urlLocation.slice(0, -1)
  return urlLocation
}
