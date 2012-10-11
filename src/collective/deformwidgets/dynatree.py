#!/usr/bin/python
# -*- coding: utf-8 -*-
from imsvdex.vdex import VDEXManager
from Products.CMFCore.utils import getToolByName
from zope.app.component.hooks import getSite
import colander
import deform
import json


def vdex_to_dynatree(vdex=None):
    '''
        Convert a vdex manager object
        to something understandable by a dynatree widget
    '''

    retval = []

    def convert(key, value):
        ''' converter '''

        retval = {}
        retval['title'] = value[0]
        retval['key'] = key
        if value[1]:
            children_keys = value[1].keys()
            children_keys.sort()
            retval['children'] = [convert(x, value[1][x]) for x in
                                  children_keys]
        return retval

    vdex_dict = vdex.getVocabularyDict()
    keys = vdex_dict.keys()
    keys.sort()
    for key in keys:
        retval.append(convert(key, vdex_dict[key]))
    return retval


class DynatreeWidgetContentBrowser(deform.widget.SelectWidget):

    '''
    Renders a ``dynatree`` widget to select contents of a site

    **Attributes/Arguments**

    vocabulary
        An imsvdex.vdex.VDEXManager object
        Can also be provided by the field

    null_value
        The value which represents the null value.  When the null
        value is encountered during serialization, the
        :attr:`colander.null` sentinel is returned to the caller.
        Default: ``\'\'`` (the empty string).

    template
        The template name used to render the widget.  Default:
        ``dynatree``.

    readonly_template
        The template name used to render the widget in read-only mode.
        Default: ``readonly/dynatree``.
    '''

    template = 'dynatree_content'
    readonly_template = 'readonly/dynatree_content'
    null_value = ''
    vocabulary = None
    requirements = (('jquery.dynatree', None), )
    selectMode = '2'

    @staticmethod
    def convert_cstruct(cstruct):
        ''' return cstruct jsonified, wrapped in a list if necessary '''

        if cstruct in (colander.null, None):
            return json.dumps([])
        else:
            return json.dumps([cstruct])

    def get_preselected_values(self, cstruct, readonly):
        '''
            for the preselected keys, get the values if necessary.
            Necessary as in the values aren\'t used in write case.
            Since computation is expensive, we return an empty
            list if readonly is set to false
        '''

        if readonly:
            retval = []
            for key in cstruct or []:
                term = self.vocabulary.getTermById(key)
                retval.append(self.vocabulary.getTermCaption(term))
            return retval
        else:
            return []

    @staticmethod
    def get_item_child_name(dummy):
        ''' Return the name of the item child '''

        return 'null'

    def titles(self, values):
        site = getSite()
        catalog = getToolByName(site, 'portal_catalog')
        for brain in catalog.searchResults(UID=values):
            yield brain.Title

    @property
    def tree(self):
        ''' return the tree datastructure as needed by dynatree, jsonified '''

        return json.dumps(vdex_to_dynatree(vdex=self.vocabulary))

    def serialize(
        self,
        field,
        cstruct,
        readonly=False,
        ):
        template = readonly and self.readonly_template or self.template
        return field.renderer(
            template,
            site_url=getSite().absolute_url(),
            field=field,
            object_provides_filter=getattr(field.schema,
                    'object_provides_filter', ''),
            values=cstruct,
            titles=self.titles(cstruct),
            dynatree_parameters='',
            fieldName=field.name,
            )


class SingleSelectDynatreeWidget(deform.widget.SelectWidget):

    '''
    Renders a ``dynatree`` widget based on a predefined set of values.

    **Attributes/Arguments**

    vocabulary
        An imsvdex.vdex.VDEXManager object
        Can also be provided by the field

    null_value
        The value which represents the null value.  When the null
        value is encountered during serialization, the
        :attr:`colander.null` sentinel is returned to the caller.
        Default: ``\'\'`` (the empty string).

    template
        The template name used to render the widget.  Default:
        ``dynatree``.

    readonly_template
        The template name used to render the widget in read-only mode.
        Default: ``readonly/dynatree``.
    '''

    template = 'dynatree'
    readonly_template = 'readonly/dynatree'
    null_value = ''
    vocabulary = None
    requirements = (('jquery.dynatree', None), )
    selectMode = '1'

    @staticmethod
    def convert_cstruct(cstruct):
        ''' return cstruct jsonified, wrapped in a list if necessary '''

        if cstruct in (colander.null, None):
            return json.dumps([])
        else:
            return json.dumps([cstruct])

    def get_preselected_values(self, cstruct, readonly):
        '''
            for the preselected keys, get the values if necessary.
            Necessary as in the values aren\'t used in write case.
            Since computation is expensive, we return an empty
            list if readonly is set to false
        '''

        if readonly:
            retval = []
            for key in cstruct or []:
                term = self.vocabulary.getTermById(key)
                retval.append(self.vocabulary.getTermCaption(term))
            return retval
        else:
            return []

    @staticmethod
    def get_item_child_name(dummy):
        ''' Return the name of the item child '''

        return 'null'

    @property
    def tree(self):
        ''' return the tree datastructure as needed by dynatree, jsonified '''

        return json.dumps(vdex_to_dynatree(vdex=self.vocabulary))

    def serialize(
        self,
        field,
        cstruct,
        readonly=False,
        ):
        if not self.vocabulary:
            self.vocabulary = getattr(field.schema, 'vocabulary',
                    self.vocabulary)
        assert self.vocabulary, 'You must give me a vocabulary'
        template = readonly and self.readonly_template or self.template
        return field.renderer(
            template,
            field=field,
            preselected=self.convert_cstruct(cstruct),
            preselected_values=self.get_preselected_values(cstruct,
                    readonly),
            tree=self.tree,
            select_mode=self.selectMode,
            item_name=field.name,
            item_child_name=self.get_item_child_name(field),
            )


class MultiSelectDynatreeWidget(SingleSelectDynatreeWidget):

    ''' Dynatree widget for sequence fields '''

    selectMode = '2'

    @staticmethod
    def convert_cstruct(cstruct):
        ''' return cstruct jsonified, wrapped in a list if necessary '''

        if cstruct in (colander.null, None):
            return json.dumps([])
        else:
            return json.dumps(cstruct)

    @staticmethod
    def get_item_child_name(field):
        ''' Return the name of the item child '''

        return field.children[0].name


class MultiSelectMode3DynatreeWidget(MultiSelectDynatreeWidget):

    ''' Dynatree widget for sequence fields mode 2 '''

    selectMode = 3
