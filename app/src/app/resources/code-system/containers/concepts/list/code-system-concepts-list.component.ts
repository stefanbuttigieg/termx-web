import {Component, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {NgForm} from '@angular/forms';
import {
  BooleanInput,
  collect,
  ComponentStateStore,
  copyDeep,
  group,
  isDefined,
  LoadingManager,
  remove,
  SearchResult,
  serializeDate,
  unique,
  validateForm
} from '@kodality-web/core-util';
import {TranslateService} from '@ngx-translate/core';
import {
  CodeSystem,
  CodeSystemConcept,
  CodeSystemEntityVersion,
  CodeSystemVersion,
  ConceptSearchParams,
  Designation,
  EntityProperty,
  EntityPropertyValue
} from 'app/src/app/resources/_lib';
import {environment} from 'environments/environment';
import {forkJoin, map, mergeMap, Observable, of, tap} from 'rxjs';
import {ConceptDrawerSearchComponent} from 'term-web/resources/_lib/code-system/containers/concept-drawer-search.component';
import {ResourceTasksWidgetComponent} from 'term-web/resources/resource/components/resource-tasks-widget.component';
import {Task} from 'term-web/task/_lib';
import {TaskService} from 'term-web/task/services/task-service';
import {CodeSystemService} from '../../../services/code-system.service';

interface ConceptNode {
  code: string;
  children?: ConceptNode[];

  expandable?: boolean;
  expanded?: boolean;
  loading?: boolean;

  concept: CodeSystemConcept
}

interface Filter {
  open: boolean,
  searchInput?: string,
  inputType: 'eq' | 'contains',

  properties?: FilterProperty[],
}

interface FilterProperty {
  property: EntityProperty,
  value: string | Date | {code: string};
}

@Component({
  selector: 'tw-code-system-concepts-list',
  templateUrl: './code-system-concepts-list.component.html',
  styles: [`
    @import "@kodality-web/marina-ui/src/components/card/style/card.style.less";

    ::ng-deep .initial:not(:last-of-type) .ant-form-item {
      margin-bottom: 0;
    }

    ::ng-deep .recursive-card-inside-flatten .m-card {
      .m-card-inside;
    }

    ::ng-deep .concept-tree {
      .m-tree-node__option {
        width: 100%;
      }

      .m-tree-toggle {
        align-self: center;
      }
    }

    .preview-container {
      position: sticky;
      top: calc(var(--page-header-height) + var(--gap-default) + 5rem); // fixme: magic number 6rem, approximate height of context header (OP-5276)
    }
  `]
})
export class CodeSystemConceptsListComponent implements OnInit, OnDestroy {
  protected readonly STORE_KEY = 'code-system-concept-list';

  @Input() public codeSystem?: CodeSystem;
  @Input() public version?: CodeSystemVersion;
  @Input() public versions?: CodeSystemVersion[];
  @Input() @BooleanInput() public viewMode: boolean | string;

  protected tableSummary: {langs?: string[], properties?: string[]} = {};
  protected selectedConcept: {code: string, version: CodeSystemEntityVersion};

  protected query = new ConceptSearchParams();
  protected searchResult = SearchResult.empty<CodeSystemConcept>();
  protected rootConcepts?: ConceptNode[] = [];

  protected filter: Filter = {open: false, inputType: 'contains'};
  protected _filter: Omit<Filter, 'open'> = this.filter; // temp, use only in tw-table-filter
  protected groupOpened = false;


  protected loader = new LoadingManager();

  protected taskModalData: {visible?: boolean, assignee?: string, comment?: string, conceptVersion?: CodeSystemEntityVersion} = {};
  @ViewChild("taskModalForm") public taskModalForm?: NgForm;
  @ViewChild(ResourceTasksWidgetComponent) public resourceTasksWidgetComponent?: ResourceTasksWidgetComponent;
  @ViewChild(ConceptDrawerSearchComponent) public conceptDrawerSearchComponent?: ConceptDrawerSearchComponent;

  public constructor(
    private codeSystemService: CodeSystemService,
    protected translateService: TranslateService,
    protected taskService: TaskService,
    private stateStore: ComponentStateStore,
  ) {
    this.query.sort = 'code';
  }

  public ngOnInit(): void {
    const state = this.stateStore.pop(this.STORE_KEY);
    if (state && state.codeSystemId === this.codeSystem?.id) {
      this.restoreState(state);
      return;
    }

    this.initConcepts();
  }

  private initConcepts(): void {
    if (this.codeSystem.hierarchyMeaning && !this.codeSystem.settings?.disableHierarchyGrouping) {
      this.groupOpened = true;
      this.expandTree();
    }

    this.loadData();
  }

  public ngOnDestroy(): void {
    this.saveState();
  }

  protected toggleView(): void {
    this.groupOpened = !this.groupOpened;
    this.filter.open = false;
    this.selectedConcept = undefined;
  }

  private expandTree(): void {
    this.groupConcepts(this.codeSystem.hierarchyMeaning);
  }

  protected groupConcepts(groupParam: string): void {
    this.loadRootConcepts(groupParam).subscribe(resp => {
      this.rootConcepts = resp.map(c => this.mapToNode(c));
    });
  }

  private loadRootConcepts(groupParam: string): Observable<CodeSystemConcept[]> {
    const params = new ConceptSearchParams();
    params.associationRoot = groupParam;
    params.codeSystemVersion = this.version?.version;
    params.sort = 'code';
    params.limit = 10000;

    return this.loader.wrap('group', this.codeSystemService.searchConcepts(this.codeSystem.id, params)).pipe(map(resp => resp.data));
  }


  // filter

  protected onFilterOpen(): void {
    this.filter.open = true;
    this._filter = structuredClone(this.filter); // copy 'active' to 'temp'
  }

  protected onFilterSearch(): void {
    this.filter = {...structuredClone(this._filter)} as Filter; // copy 'temp' to 'active'
    this.query.offset = 0;
    this.loadData();
  }

  protected onFilterReset(): void {
    this.filter = {open: this.filter.open, inputType: 'contains'};
    this._filter = structuredClone(this.filter);
  }

  protected onFilterPropertyAdd(ep: EntityProperty): void {
    if (ep) {
      this._filter.properties ??= [];
      this._filter.properties = [...this._filter.properties, {property: ep, value: undefined}];
    }
  }

  protected onFilterPropertyRemove(ep: FilterProperty): void {
    this._filter.properties = remove(this._filter.properties, ep);
  }

  protected isFilterSelected(filter: Filter): boolean {
    const exclude: (keyof Filter)[] = ['open', 'searchInput', 'inputType'];
    return Object.keys(filter)
      .filter((k: keyof Filter) => !exclude.includes(k))
      .some(k => Array.isArray(filter[k]) ? !!filter[k].length : isDefined(filter[k]));
  }


  // searches

  protected loadData(): void {
    this.search().subscribe(resp => this.searchResult = resp);
  }

  private search(): Observable<SearchResult<CodeSystemConcept>> {
    const q = copyDeep(this.query);
    if (this.filter.inputType === 'eq') {
      q.textEq = this.filter.searchInput;
    } else if (this.filter.inputType === 'contains') {
      q.textContains = this.filter.searchInput;
      q.textContainsSep = ' ';
    }
    q.codeSystemVersion = this.version?.version;

    const collected = collect(this.filter.properties ?? [],
      p => p.property.name,
      p => {
        if (typeof p.value === 'object') {
          if (p.value instanceof Date) {
            return serializeDate(p.value);
          }
          return p.value?.code;
        }
        return p.value;
      });

    q.propertyValues = Object.entries(collected).map(([k, v]) => `${k}|${v.join(',')}`).join(';');

    return this.loader.wrap('search', this.codeSystemService.searchConcepts(this.codeSystem.id, q));
  }


  // tree

  protected expandNode(node: ConceptNode): void {
    if (node.expanded) {
      node.expanded = false;
      node.children = [];
      return;
    }

    if (!node.loading) {
      node.loading = true;

      this.loadChildren(node.code).subscribe(concepts => {
        node.children = concepts.data.map(c => this.mapToNode(c));
        node.expanded = true;
      }).add(() => node.loading = false);
    }
  }

  private loadChildren(code: string): Observable<SearchResult<CodeSystemConcept>> {
    const params = new ConceptSearchParams();
    params.associationSource = `${this.codeSystem.hierarchyMeaning}|${code}`;
    params.codeSystemVersion = this.version?.version;
    params.sort = 'code';
    //params.limit = 1000;
    return this.codeSystemService.searchConcepts(this.codeSystem.id, params);
  }

  private mapToNode(c: CodeSystemConcept): ConceptNode {
    return {
      code: c.code,
      expandable: !c.leaf,
      concept: c
    };
  }


  // routes

  protected getConceptEditRoute = (code?: string, parentCode?: string): {path: any[], query: any} => {
    if (!code) {
      const path = `/resources/code-systems/${this.codeSystem.id}${this.version?.version ? `/versions/${this.version?.version}/concepts/add` :
        '/concepts/add'}`;
      return {path: [path], query: {parent: parentCode}};
    }

    const mode = this.viewMode ? '/view' : '/edit';
    const path = `/resources/code-systems/${this.codeSystem.id}${this.version?.version ? `/versions/${this.version?.version}/concepts/` :
      '/concepts/'}${encodeURIComponent(code)}${mode}`;
    return {path: [path], query: {parent: parentCode}};
  };


  // utils

  protected availableProps = (eps: EntityProperty[], filterEps: FilterProperty[]): EntityProperty[] => {
    const applied = filterEps?.map(fep => fep.property.name) ?? [];
    return eps.filter(ep => !applied.includes(ep.name))
  };

  protected propertyKind = (ep: EntityProperty): boolean => {
    return ep.kind === 'property';
  };

  protected getDesignations = (concept: CodeSystemConcept): Designation[] => {
    return concept.versions?.flatMap(v => v.designations).filter(d => isDefined(d));
  };

  protected getPropertyValues = (concept: CodeSystemConcept): EntityPropertyValue[] => {
    return concept.versions?.flatMap(v => v.propertyValues).filter(pv => isDefined(pv));
  };

  protected filterPropertyValues = (pv: EntityPropertyValue, selectedProperties: string[], csProperties: EntityProperty[]): boolean => {
    if (selectedProperties?.length > 0) {
      return selectedProperties.includes(pv.entityProperty);
    }
    return !!csProperties?.find(p => p.id === pv.entityPropertyId && p.showInList);
  };

  protected getSupportedLangs = (version: CodeSystemVersion, versions: CodeSystemVersion[]): string[] => {
    if (version) {
      return version.supportedLanguages;
    }
    if (versions) {
      return versions.flatMap(v => v.supportedLanguages).filter(unique);
    }
    return [];
  };

  protected getProperty = (id: number, properties: EntityProperty[]): EntityProperty => {
    return properties?.find(p => p.id === id);
  };


  // events

  protected selectConcept(concept: CodeSystemConcept): void {
    if (concept?.code === this.selectedConcept?.code) {
      this.selectedConcept = undefined;
    } else {
      this.selectedConcept = {code: concept.code, version: concept.versions?.[concept.versions.length - 1]};
    }
  }

  protected openFhir(code: string): void {
    window.open(window.location.origin + environment.baseHref + 'fhir/CodeSystem/' + this.codeSystem.id + '/lookup' + '?_code=' + code, '_blank');
  }

  protected unlink(concept: CodeSystemConcept): void {
    const entityVersionIds = concept.versions.map(v => v.id);
    this.codeSystemService.unlinkEntityVersions(this.codeSystem.id, this.version.version, entityVersionIds).subscribe(() => {
      if (this.codeSystem.hierarchyMeaning) {
        this.expandTree();
      }
      this.loadData();
    });
  }

  protected propagateProperties(concept: CodeSystemConcept): void {
    this.loadChildren(concept.code).subscribe(children => {
      this.codeSystemService.propagateProperties(this.codeSystem.id, concept.code, children.data.map(c => c.id)).subscribe(() => {
        this.expandTree();
      });
    });
  }

  protected createTask(): void {
    if (!validateForm(this.taskModalForm)) {
      return;
    }

    const task = new Task();
    task.workflow ??= 'concept-review';
    task.assignee = this.taskModalData.assignee;
    task.title = `Review code system "${this.codeSystem?.id}" concept "${this.taskModalData.conceptVersion.code}"`;
    task.context = [
      {type: 'code-system', id: this.codeSystem.id},
      this.taskModalData.conceptVersion?.id ? {type: 'concept-version', id: this.taskModalData.conceptVersion.id} : undefined,
      this.version?.id ? {type: 'code-system-version', id: this.version.id} : undefined
    ].filter(c => isDefined(c));
    task.content = 'Review the content of the concept [' + this.taskModalData.conceptVersion.code + ']' +
      '(concept:' + this.codeSystem.id + '|' + this.taskModalData.conceptVersion.code + ').' +
      (this.taskModalData.comment ? '\n' + this.taskModalData.comment : '');
    this.loader.wrap('create-task', this.taskService.save(task)).subscribe(() => {
      this.taskModalData = {};
      this.resourceTasksWidgetComponent.loadTasks();
    });
  }


  // state

  private saveState(): void {
    const collectExpandedCodes = (nodes: ConceptNode[], res: string[]) => {
      nodes?.filter(n => n.expanded).forEach(n => {
        res.push(n.code);
        collectExpandedCodes(n.children, res);
      });
    };

    const expanded = [];
    collectExpandedCodes(this.rootConcepts, expanded);

    this.stateStore.put(this.STORE_KEY, {
      codeSystemId: this.codeSystem.id,

      groupOpened: this.groupOpened,
      tableView: this.tableSummary,
      filter: this.filter,

      query: this.query,
      expandedNodes: expanded,

      scrollY: window.scrollY
    });
  }

  private restoreState(state): void {
    this.groupOpened = state.groupOpened;

    this.tableSummary = state.tableView;
    this.filter = state.filter;
    this.query = state.query;

    const searchResult$ = this.search().pipe(
      tap(resp => this.searchResult = resp)
    );

    const rootConcepts$ = (this.codeSystem?.hierarchyMeaning ? this.loadRootConcepts(this.codeSystem.hierarchyMeaning) : of([])).pipe(
      mergeMap(concepts => {
        const roots = concepts.map(c => this.mapToNode(c));
        const children: Observable<{code: string, data: CodeSystemConcept[]}>[] = state.expandedNodes.map(code => {
          return this.loadChildren(code).pipe(map(r => ({code, data: r.data})));
        });
        return forkJoin([of(roots), ...children]);
      }),
      tap(([rootConcepts, ...resp]) => {
        this.rootConcepts = rootConcepts;

        const childMap = group(resp, v => v.code, v => v.data);
        const expand = (child: ConceptNode): void => {
          if (childMap[child.code]) {
            child.expanded = true;
            child.children = childMap[child.code].map(n => this.mapToNode(n));
            child.children.forEach(c => expand(c));
          }
        };
        this.rootConcepts.forEach(c => expand(c));
      })
    );

    this.loader.wrap('group', forkJoin([searchResult$, rootConcepts$])).subscribe(() => {
      setTimeout(() => {
        window.scrollTo({
          top: state.scrollY,
          left: 0,
          behavior: 'smooth',
        });
      });
    });
  }

  public createSupplement(versionIds: number[]): void {
    this.codeSystemService.supplementEntityVersions(this.codeSystem?.id, this.version?.version, {ids: versionIds}).subscribe(() => this.initConcepts());
  }
  public createExternalSupplement(code: string): void {
    this.codeSystemService.supplementEntityVersions(this.codeSystem?.id, this.version?.version, {externalSystemCode: code}).subscribe(() => this.initConcepts());
  }

  public activateConcepts(): void {
    this.codeSystemService.activateEntityVersions(this.codeSystem?.id, this.version?.version).subscribe(() => this.initConcepts());
  }
}
